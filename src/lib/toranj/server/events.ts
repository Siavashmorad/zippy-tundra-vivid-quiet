import { getSql } from "@/lib/db";
import { nid } from "../ids";

export async function emitShopEvent(
  shopId: string,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const sql = await getSql();
  await sql`insert into shop_events (shop_id, type, payload)
    values (${shopId}, ${type}, ${JSON.stringify(payload)})`;
}

export async function createNotification(input: {
  shopId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, string>;
}): Promise<string> {
  const sql = await getSql();
  const payload = input.payload ?? {};
  const eventId = payload.eventId?.trim();

  if (eventId) {
    const existing = await sql<{ id: string }>`
      select id from notifications
      where user_id = ${input.userId}
        and payload::jsonb->>'eventId' = ${eventId}
      order by created_at desc
      limit 1`;
    if (existing[0]?.id) return String(existing[0].id);
  }

  const id = nid("ntf");
  await sql`insert into notifications (id, shop_id, user_id, type, title, body, payload)
    values (${id}, ${input.shopId}, ${input.userId}, ${input.type}, ${input.title}, ${input.body}, ${JSON.stringify(payload)})`;

  try {
    await emitShopEvent(input.shopId, "notification.created", {
      notificationId: id,
      userId: input.userId,
      type: input.type,
    });
  } catch (err) {
    console.error("[notify] realtime event failed", err);
  }
  return id;
}

export async function listEventsSince(shopId: string, afterId: number, limit = 50) {
  const sql = await getSql();
  return sql<{
    id: number;
    shop_id: string;
    type: string;
    payload: string;
    created_at: unknown;
  }>`select id, shop_id, type, payload, created_at
    from shop_events
    where shop_id = ${shopId} and id > ${afterId}
    order by id asc
    limit ${limit}`;
}

export async function pruneOldEvents(shopId: string): Promise<void> {
  const sql = await getSql();
  await sql`delete from shop_events
    where shop_id = ${shopId}
      and id < (
        select coalesce(max(id), 0) - 800 from shop_events where shop_id = ${shopId}
      )`;
}
