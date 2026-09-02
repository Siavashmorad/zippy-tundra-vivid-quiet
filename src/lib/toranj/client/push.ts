import {
  getPushPublicKey,
  registerDeviceToken,
  registerPushSubscription,
  unregisterDeviceToken,
} from "@/lib/toranj/api/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(appRole: "seller" | "customer" = "seller"): Promise<
  "granted" | "denied" | "unsupported"
> {
  // Capacitor native path (when plugin is present on device builds).
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const mod = await import("@capacitor/push-notifications").catch(() => null);
      if (mod?.PushNotifications) {
        const perm = await mod.PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return "denied";
        await mod.PushNotifications.register();
        await new Promise<void>((resolve) => {
          void mod.PushNotifications.addListener("registration", (token) => {
            void registerDeviceToken({
              data: { token: token.value, platform: "android", appRole },
            }).finally(() => resolve());
          });
          window.setTimeout(() => resolve(), 4000);
        });
        return "granted";
      }
    }
  } catch {
    /* fall through to web push */
  }

  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (!window.isSecureContext) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const { publicKey } = await getPushPublicKey();
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("ثبت اعلان ناموفق بود.");
  }
  await registerPushSubscription({
    data: {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  });
  return "granted";
}

export async function disablePush(token?: string): Promise<void> {
  try {
    await unregisterDeviceToken({ data: token ? { token } : {} });
  } catch {
    /* ignore */
  }
}

export async function registerSw(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    /* ignore */
  }
}
