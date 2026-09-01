import { getRequest } from "@tanstack/react-start/server";
import { gateIdentityEnabled } from "./gate-identity.server";
import { auth, authConfigured } from "./server";

/**
 * Server-side session resolution (server-only).
 *
 * The production seller app uses the app's own Better Auth at same-origin
 * `/api/auth/*`. Email/password authentication is sufficient for production;
 * the optional Grok OAuth broker must not be required for ordinary sessions.
 */

/** True when a real database is configured server-side. */
const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

/** Local Better Auth is usable whenever the real DB exists and email/password is enabled. */
const localAuthConfigured =
  databaseConfigured && process.env.VITE_AUTH_ENABLED !== "false";

/** Re-export the broker configuration flag for callers that explicitly need it. */
export { authConfigured };

/** Dev fallback user id, used only when auth is disabled and no real database exists. */
export const DEV_USER_ID = "dev-user";

/** Thrown by `requireUserId` when the caller has no valid session. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * Resolve the signed-in user from the current request.
 *
 * A production Postgres deployment may intentionally have no Grok OAuth broker
 * credentials because the seller uses local email/password. Therefore this
 * function must not gate normal Better Auth sessions on `authConfigured`.
 */
export async function getSessionUser(
  bearerToken?: string,
): Promise<VerifiedUser | null> {
  if (!localAuthConfigured && !gateIdentityEnabled()) return null;
  const request = getRequest();
  if (!request) return null;
  let headers = request.headers;
  if (bearerToken) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/**
 * Resolve the current user id for a server function.
 *
 * - Production/local real DB + auth enabled -> verified Better Auth session.
 * - Gate identity -> verified gate identity/session.
 * - Auth disabled + real DB -> fail closed; never share `dev-user`.
 * - Auth disabled + no DB -> development fallback user.
 */
export async function requireUserId(bearerToken?: string): Promise<string> {
  if (localAuthConfigured || gateIdentityEnabled()) {
    const user = await getSessionUser(bearerToken);
    if (!user) throw new UnauthorizedError();
    return user.id;
  }

  if (databaseConfigured) {
    throw new Error(
      "احراز هویت غیرفعال است و پایگاه‌داده واقعی تنظیم شده؛ استفاده از کاربر آزمایشی مجاز نیست.",
    );
  }

  return DEV_USER_ID;
}
