import { Capacitor } from "@capacitor/core";
import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { runPreSignInSignOut, runSignOut } from "../../../scripts/sign-out-plan.mjs";
import { GROK_PROVIDERS } from "./providers";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so after a
 * popup sign-in it can't read the session cookie — it authenticates with a
 * bearer token instead (captured from the popup, see `signIn`). The `onRequest`
 * hook attaches that token when present; when deployed (cookie auth) no token
 * is stored, so nothing changes.
 *
 * Native Capacitor builds additionally persist the Better Auth session bearer
 * token in WebView local storage. This is a session token, never the password,
 * and is only used as a fallback when Android WebView cookie persistence is not
 * reliable. The server still validates the token against Better Auth on every
 * request and logout revokes the server-side session.
 *
 * To sign out call `signOut()` below, NOT `authClient.signOut()`: the raw call
 * leaves the bearer token in place, and `onRequest` keeps re-attaching it, so the
 * visitor stays signed in.
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/**
 * Production safety rule: a deployed build must NEVER silently fall back to the
 * shared dev user. That fallback is useful only inside the local builder
 * workspace. Capacitor loads the production Vercel origin, so forcing auth on in
 * production guarantees an unauthenticated Android install reaches `/login`
 * instead of mounting SellerApp and failing its first authenticated server call.
 *
 * Local development keeps the `.grok/app-env.json` switch so the existing test
 * and preview workflows remain unchanged.
 */
export const authEnabled =
  import.meta.env.PROD || import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The upstream providers to render sign-in buttons for. */
export { GROK_PROVIDERS };

// ── Persistent native bearer token ──────────────────────────────────────────
const PREVIEW_BEARER_KEY = "grok-auth.bearer-token";
const NATIVE_BEARER_KEY = "toranj.auth.session-token";

function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Store a Better Auth session token in native WebView storage only. */
function setNativeBearerToken(token: string | null): void {
  if (typeof window === "undefined" || !isNativeApp()) return;
  try {
    if (token) window.localStorage.setItem(NATIVE_BEARER_KEY, token);
    else window.localStorage.removeItem(NATIVE_BEARER_KEY);
  } catch {
    // Storage can be unavailable in restricted WebViews; cookie auth remains the fallback.
  }
}

function getNativeBearerToken(): string | null {
  if (typeof window === "undefined" || !isNativeApp()) return null;
  try {
    return window.localStorage.getItem(NATIVE_BEARER_KEY);
  } catch {
    return null;
  }
}

function clearNativeBearerToken(): void {
  setNativeBearerToken(null);
}

/** Capture Better Auth's documented set-auth-token response header after sign-in. */
function captureAuthResponseToken(ctx: { response?: Response }): void {
  try {
    const token = ctx.response?.headers.get("set-auth-token")?.trim();
    if (token) setNativeBearerToken(token);
  } catch {
    // A missing header is harmless; the normal session cookie may still work.
  }
}

/** The stored session bearer token, or null. */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  if (isNativeApp()) return getNativeBearerToken();
  try {
    return window.sessionStorage.getItem(PREVIEW_BEARER_KEY);
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (isNativeApp()) {
    setNativeBearerToken(token);
    return;
  }
  try {
    if (token) window.sessionStorage.setItem(PREVIEW_BEARER_KEY, token);
    else window.sessionStorage.removeItem(PREVIEW_BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * The sandbox live preview runs this app inside an iframe on a `*.grok-sandbox.com`
 * host, where a full-page redirect to the broker can't work — so sign-in uses a
 * popup there and a normal redirect everywhere else.
 */
function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

type PopupMessage = { source: "grok-auth-popup"; token: string | null; error?: string };

export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/";
  const popup = inLivePreview() ? openSignInPopup(providerId) : null;

  await runPreSignInSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    requestSignOut: () => authClient.signOut(),
    clearToken: () => setBearerToken(null),
  });

  if (inLivePreview()) {
    if (!popup) throw new Error("Pop-up blocked — allow pop-ups for sign-in");
    const token = await waitForPopupToken(popup);
    if (!token) throw new Error("Sign-in was cancelled or failed");
    setBearerToken(token);
    try {
      await authClient.getSession();
    } catch {
      /* session store will recover on next useSession fetch */
    }
    if (typeof window !== "undefined") {
      const dest = new URL(callbackURL, window.location.origin);
      const here = window.location;
      if (dest.origin !== here.origin || dest.pathname !== here.pathname || dest.search !== here.search) {
        window.location.href = callbackURL;
      }
    }
    return;
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

function openSignInPopup(providerId: string): Window | null {
  const origin = window.location.origin;
  const url = `${origin}/auth/popup?providerId=${encodeURIComponent(providerId)}`;
  const name = `grok-signin-${Date.now()}`;
  return window.open(url, name, "popup,width=500,height=650");
}

function waitForPopupToken(popup: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const origin = window.location.origin;
    let settled = false;
    let closeTimer: number | undefined;
    const settle = (token: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      settle(data.token ?? null);
    };
    const pollTimer = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(pollTimer);
      closeTimer = window.setTimeout(() => settle(null), 400);
    }, 300);
    function cleanup() {
      window.clearInterval(pollTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

export async function signOut(redirectTo = "/"): Promise<void> {
  await runSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    requestSignOut: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    clearToken: () => {
      setBearerToken(null);
      clearNativeBearerToken();
    },
    redirect: () => {
      window.location.href = redirectTo;
    },
  });
}
