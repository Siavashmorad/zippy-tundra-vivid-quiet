import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { registerDeviceToken } from "@/lib/toranj/api/push";

type PushData = Record<string, unknown> & { title?: string; body?: string; eventId?: string; orderId?: string; messageId?: string; customerId?: string; type?: string; url?: string; tag?: string };
const DEFAULT_CHANNEL_ID = "toranj";
const DEDUP_KEY = "toranj.push.seen.v1";
const DEDUP_TTL = 24 * 60 * 60 * 1000;

function eventKey(data: PushData) { return typeof data.eventId === "string" && data.eventId.trim() ? data.eventId.trim() : typeof data.tag === "string" && data.tag.trim() ? data.tag.trim() : ""; }
function hashNotificationId(value: string): number { let hash = 0; for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0; const id = Math.abs(hash); return id === 0 ? 1 : id; }
function buildDeepLink(data: PushData): string {
  if (typeof data.url === "string" && data.url.trim()) return data.url;
  if (data.orderId) {
    const sellerOrder = data.type === "new_order" || data.type === "order.new";
    return `${sellerOrder ? "/" : "/c"}?tab=orders&order=${encodeURIComponent(data.orderId)}`;
  }
  if (data.messageId && data.customerId) return `/?tab=messages&customer=${encodeURIComponent(data.customerId)}&message=${encodeURIComponent(data.messageId)}`;
  if (data.customerId) return `/?tab=messages&customer=${encodeURIComponent(data.customerId)}`;
  return "/";
}
function openSafeUrl(raw: unknown) { if (typeof window === "undefined" || typeof raw !== "string" || !raw) return; try { const url = new URL(raw, window.location.origin); if (url.origin === window.location.origin) window.location.assign(`${url.pathname}${url.search}${url.hash}`); } catch {} }
function readSeen(): Record<string, number> { try { const raw = window.localStorage.getItem(DEDUP_KEY); if (!raw) return {}; const parsed = JSON.parse(raw) as Record<string, number>; const now = Date.now(); return Object.fromEntries(Object.entries(parsed).filter(([, ts]) => Number.isFinite(ts) && now - ts < DEDUP_TTL)); } catch { return {}; } }
function markSeen(key: string) { if (!key) return; try { const seen = readSeen(); seen[key] = Date.now(); window.localStorage.setItem(DEDUP_KEY, JSON.stringify(seen)); } catch {} }
function wasSeen(key: string) { return !!key && Object.prototype.hasOwnProperty.call(readSeen(), key); }
async function registerTokenWithRetry(token: string, appRole: "seller" | "customer") { const delays = [0, 1500, 4000, 10000, 30000, 60000]; for (const delay of delays) { if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay)); try { await registerDeviceToken({ data: { token, platform: "android", appRole } }); return; } catch (err) { console.warn("[native-push] token registration retry failed", err); } } }

export async function setupNativePush(appRole: "seller" | "customer") {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return () => {};
  try {
    const permission = await PushNotifications.requestPermissions(); if (permission.receive !== "granted") return () => {};
    try { await LocalNotifications.requestPermissions(); await LocalNotifications.createChannel({ id: DEFAULT_CHANNEL_ID, name: "اعلان‌های ترنج", description: "اعلان سفارش‌ها و پیام‌های ترنج", importance: 5, sound: "default", vibration: true }); } catch (err) { console.warn("[native-push] local setup failed", err); }
    const listeners = [
      await PushNotifications.addListener("registration", ({ value }) => { if (value) void registerTokenWithRetry(value, appRole); }),
      await PushNotifications.addListener("registrationError", (err) => console.error("[native-push] registration error", err)),
      await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
        const data = (notification.data ?? {}) as PushData; const key = eventKey(data); if (wasSeen(key)) return; markSeen(key);
        try { await LocalNotifications.schedule({ notifications: [{ id: hashNotificationId(key || `${notification.title}:${notification.body}`), title: String(notification.title ?? data.title ?? "ترنج"), body: String(notification.body ?? data.body ?? "اعلان جدید دارید."), channelId: DEFAULT_CHANNEL_ID, extra: data, schedule: { at: new Date(Date.now() + 250) } }] }); } catch (err) { console.error("[native-push] foreground notification failed", err); }
      }),
      await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => { openSafeUrl(buildDeepLink((notification.data ?? {}) as PushData)); }),
      await LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => { openSafeUrl(buildDeepLink((notification.extra ?? {}) as PushData)); }),
    ];
    await PushNotifications.register();
    return () => { for (const listener of listeners) void listener.remove(); };
  } catch (err) { console.error("[native-push] setup failed", err); return () => {}; }
}
