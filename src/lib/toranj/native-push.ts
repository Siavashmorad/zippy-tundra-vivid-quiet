import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { registerDeviceToken } from "@/lib/toranj/api/push";

type PushData = Record<string, unknown> & {
  title?: string;
  body?: string;
  url?: string;
};

const DEFAULT_CHANNEL_ID = "toranj";

function openSafeUrl(raw: unknown) {
  if (typeof raw !== "string" || !raw) return;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin) window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Ignore malformed or external notification URLs.
  }
}

async function registerTokenWithRetry(token: string, appRole: "seller" | "customer") {
  const delays = [0, 1500, 4000, 10000, 30000, 60000];
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    try {
      await registerDeviceToken({ data: { token, platform: "android", appRole } });
      return;
    } catch (err) {
      console.warn("[native-push] token registration retry failed", err);
    }
  }
}

export async function setupNativePush(appRole: "seller" | "customer") {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return () => {};

  try {
    const pushPermission = await PushNotifications.requestPermissions();
    if (pushPermission.receive !== "granted") {
      console.warn("[native-push] notification permission was not granted");
      return () => {};
    }

    try {
      await LocalNotifications.requestPermissions();
      await LocalNotifications.createChannel({
        id: DEFAULT_CHANNEL_ID,
        name: "اعلان‌های ترنج",
        description: "اعلان سفارش‌ها و پیام‌های ترنج",
        importance: 5,
        sound: "default",
        vibration: true,
      });
    } catch (err) {
      console.warn("[native-push] local notification setup failed", err);
    }

    const listeners = [
      await PushNotifications.addListener("registration", ({ value }) => {
        if (!value) return;
        void registerTokenWithRetry(value, appRole);
      }),
      await PushNotifications.addListener("registrationError", (err) => {
        console.error("[native-push] registration error", err);
      }),
      await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
        const data = (notification.data ?? {}) as PushData;
        const title = String(notification.title ?? data.title ?? "ترنج");
        const body = String(notification.body ?? data.body ?? "اعلان جدید دارید.");
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Date.now() % 2147483647),
                title,
                body,
                channelId: DEFAULT_CHANNEL_ID,
                smallIcon: "ic_stat_icon_config_sample",
                extra: data,
                schedule: { at: new Date(Date.now() + 250) },
              },
            ],
          });
        } catch (err) {
          console.error("[native-push] foreground notification failed", err);
        }
      }),
      await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        openSafeUrl((notification.data as PushData | undefined)?.url);
      }),
      await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
        openSafeUrl((notification.extra as PushData | undefined)?.url);
      }),
    ];

    await PushNotifications.register();

    return () => {
      for (const listener of listeners) void listener.remove();
    };
  } catch (err) {
    console.error("[native-push] setup failed", err);
    return () => {};
  }
}
