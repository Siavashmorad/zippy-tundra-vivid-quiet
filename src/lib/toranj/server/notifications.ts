import { getSql } from "@/lib/db";

export type UserNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
};

function mapRow(row: Record<string, unknown>): UserNotification {
  let payload: Record<string, string> = {};
  if (typeof row.payload === "string") {
    try {
      const parsed = JSON.parse(row.payload) as Record<string, unknown>;
      payload = Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)]),
      );
    } catch {
      payload = {};
    }
  } else if (row.payload && typeof row.payload === "object") {
    payload = Object.fromEntries(
      Object.entries(row.payload as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
    );
  }
  return {
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    payload,
    readAt: row.read_at == null ? null : new Date(String(row.read_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function listNotifications(userId: string, limit = 80): Promise<UserNotification[]> {
  const sql = await getSql();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const rows = await sql<Record<string, unknown>>`
    select id, type, title, body, payload, read_at, created_at
    from notifications
    where user_id = ${userId}
    order by created_at desc
    limit ${safeLimit}`;
  return rows.map(mapRow);
}

export async function countUnreadNotifications(userId: string): Promise<{ count: number }> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from notifications
    where user_id = ${userId} and read_at is null`;
  return { count: rows[0]?.n ?? 0 };
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update notifications
    set read_at = coalesce(read_at, now())
    where id = ${notificationId} and user_id = ${userId}`;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update notifications
    set read_at = now()
    where user_id = ${userId} and read_at is null`;
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    delete from notifications
    where id = ${notificationId} and user_id = ${userId}`;
}
