/** Best-effort notification fan-out: DB/in-app first, native FCM and web push second. */
import { createNotification } from "./events";
import { sendPushToUser } from "./push";
function resolveEventId(input: { type: string; userId: string; title: string; body: string; payload?: Record<string, string> }): string {
  const p = input.payload ?? {};
  if (p.eventId?.trim()) return p.eventId.trim();
  if (p.orderId) return `${input.type}:order:${p.orderId}:${p.status ?? ""}`;
  if (p.messageId) return `${input.type}:message:${p.messageId}`;
  if (p.broadcastId) return `${input.type}:broadcast:${p.broadcastId}:${p.customerId ?? ""}`;
  if (p.customerId) return `${input.type}:customer:${p.customerId}`;
  return `${input.type}:${input.userId}:${input.title}:${input.body}`;
}
export async function notifyUserSafe(input: { shopId: string; userId: string; type: string; title: string; body: string; payload?: Record<string, string>; url?: string; tag?: string; appRole?: "seller" | "customer" }): Promise<void> {
  try {
    const eventId = resolveEventId(input);
    const notificationPayload = { ...(input.payload ?? {}), eventId };
    await createNotification({ shopId: input.shopId, userId: input.userId, type: input.type, title: input.title, body: input.body, payload: notificationPayload });
    try {
      const expectedRole = input.appRole ?? (input.type === "order.new" || input.payload?.senderRole === "customer" ? "seller" : "customer");
      await sendPushToUser(input.userId, { title: input.title, body: input.body, eventId, orderId: input.payload?.orderId, messageId: input.payload?.messageId, customerId: input.payload?.customerId, type: input.type, url: input.url, tag: input.tag ?? eventId }, expectedRole);
    } catch (err) { console.error("[notify] push delivery failed", err); }
  } catch (err) { console.error("[notify] notification persistence failed", err); }
}
