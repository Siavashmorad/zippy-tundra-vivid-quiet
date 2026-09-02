/**
 * Safe notification fan-out: persists in-app row + best-effort push.
 * Never throws — order/message mutations must not fail because of push.
 */
import { createNotification } from "./events";
import { sendPushToUser } from "./push";

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
    await createNotification({
      shopId: input.shopId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
    });
  } catch (err) {
    console.error("[notify] createNotification failed", err);
  }
  try {
    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      url: input.url,
      tag: input.tag,
    });
  } catch (err) {
    console.error("[notify] sendPushToUser failed", err);
  }
}
