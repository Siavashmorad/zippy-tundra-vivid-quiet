import { registerDeviceToken } from "@/lib/toranj/api/push";

type PushPlugin = {
  requestPermissions: () => Promise<{ receive?: "granted" | "denied" | "prompt" }>;
  register: () => Promise<void>;
  addListener: (event: "registration" | "registrationError" | "pushNotificationReceived" | "pushNotificationActionPerformed", cb: (data: any) => void) => Promise<{ remove: () => Promise<void> }>;
};
type LocalPlugin = { createChannel?: (options: Record<string, unknown>) => Promise<void>; schedule: (options: { notifications: Array<Record<string, unknown>> }) => Promise<void> };
type CapacitorWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { PushNotifications?: PushPlugin; LocalNotifications?: LocalPlugin } } };

function getPlugins() {
  const c = (window as CapacitorWindow).Capacitor;
  return { push: c?.Plugins?.PushNotifications, local: c?.Plugins?.LocalNotifications, native: Boolean(c?.isNativePlatform?.()) };
}

export async function setupNativePush(appRole: "seller" | "customer") {
  if (typeof window === "undefined") return () => {};
  const { push, local, native } = getPlugins();
  if (!native || !push) return () => {};
  try {
    const permission = await push.requestPermissions();
    if (permission.receive !== "granted") return () => {};
    await local?.createChannel?.({ id: "toranj", name: "اعلان‌های ترنج", description: "اعلان سفارش‌ها و پیام‌های ترنج", importance: 5, sound: "default", vibration: true });
    const listeners: Array<{ remove: () => Promise<void> }> = [];
    listeners.push(await push.addListener("registration", async ({ value }: { value?: string }) => {
      if (!value) return;
      try { await registerDeviceToken({ data: { token: value, platform: "android", appRole } }); }
      catch (err) { console.error("[native-push] token registration failed", err); }
    }));
    listeners.push(await push.addListener("registrationError", (err) => console.error("[native-push] registration error", err)));
    listeners.push(await push.addListener("pushNotificationReceived", async (notification) => {
      const title = String(notification?.title ?? notification?.data?.title ?? "ترنج");
      const body = String(notification?.body ?? notification?.data?.body ?? "اعلان جدید دارید.");
      if (local) {
        try { await local.schedule({ notifications: [{ id: Math.floor(Date.now() % 2147483647), title, body, channelId: "toranj", schedule: { at: new Date(Date.now() + 250) }, extra: notification?.data ?? {} }] }); }
        catch (err) { console.error("[native-push] foreground notification failed", err); }
      }
    }));
    listeners.push(await push.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = notification?.data?.url;
      if (typeof url === "string" && url) window.location.assign(url);
    }));
    await push.register();
    return () => { for (const listener of listeners) void listener.remove(); };
  } catch (err) {
    console.error("[native-push] setup failed", err);
    return () => {};
  }
}
