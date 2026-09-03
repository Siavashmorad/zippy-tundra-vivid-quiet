/**
 * Safe in-app notification fan-out.
 * Notification persistence and realtime signaling are best-effort and never
 * make an order/message mutation fail. Native/FCM/Web Push is intentionally
 * not invoked in this stage.
 */
import { createNotification } from "./events";

function resolveEventId(input: {
  type: string;
  userId: string;
  title: string;
  body: string;
  payload?: Record<string, string>;
}): string {
  const p = input.payload ?? {};
  if (p.eventId?.trim()) return p.eventId.trim();
  if (p.orderId) return `${input.type}:order:${p.orderId}:${p.status ?? ""}`;
  if (p.messageId) return `${input.type}:message:${p.messageId}`;
  if (p.broadcastId) return `${input.type}:broadcast:${p.broadcastId}:${p.customerId ?? ""}`;
  if (p.customerId) return `${input.type}:customer:${p.customerId}`;
  return `${input.type}:${input.userId}:${input.title}:${input.body}`;
}

export async function notifyUserSafe(input: {
  shopId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, string>;
  url?: string;
  tag?: string;
}): Promise<void> {
  try {
    const eventId = resolveEventId(input);
    await createNotification({
      shopId: input.shopId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: { ...(input.payload ?? {}), eventId },
    });
  } catch (err) {
    console.error("[notify] createNotification failed", err);
  }
}
