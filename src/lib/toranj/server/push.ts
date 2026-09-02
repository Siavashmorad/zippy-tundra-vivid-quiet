import * as webpush from "web-push";
import { getSql } from "@/lib/db";
import { nid } from "../ids";

type Vapid = { publicKey: string; privateKey: string };

async function loadVapid(): Promise<Vapid> {
  const sql = await getSql();
  const rows = await sql<{ value: string }>`select value from app_secrets where key = 'vapid' limit 1`;
  if (rows[0]?.value) {
    try {
      return JSON.parse(rows[0].value) as Vapid;
    } catch {
      /* regenerate */
    }
  }
  const keys = webpush.generateVAPIDKeys();
  await sql`insert into app_secrets (key, value, updated_at)
    values ('vapid', ${JSON.stringify(keys)}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return keys;
}

export async function getVapidPublicKey(): Promise<string> {
  const keys = await loadVapid();
  return keys.publicKey;
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const sql = await getSql();
  const id = nid("psh");
  await sql`insert into push_subscriptions (id, user_id, endpoint, p256dh, auth_secret)
    values (${id}, ${input.userId}, ${input.endpoint}, ${input.p256dh}, ${input.auth})
    on conflict (endpoint) do update set
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth_secret = excluded.auth_secret`;
}

export async function saveDeviceToken(input: {
  userId: string;
  token: string;
  platform?: string;
  appRole?: string;
}): Promise<void> {
  const sql = await getSql();
  const token = input.token.trim();
  if (!token) return;
  const id = nid("dvt");
  await sql`insert into device_tokens (id, user_id, token, platform, app_role, active, last_seen_at)
    values (
      ${id},
      ${input.userId},
      ${token},
      ${input.platform ?? "android"},
      ${input.appRole ?? "seller"},
      true,
      now()
    )
    on conflict (token) do update set
      user_id = excluded.user_id,
      platform = excluded.platform,
      app_role = excluded.app_role,
      active = true,
      last_seen_at = now()`;
}

export async function deactivateDeviceToken(userId: string, token?: string): Promise<void> {
  const sql = await getSql();
  if (token?.trim()) {
    await sql`update device_tokens set active = false, last_seen_at = now()
      where user_id = ${userId} and token = ${token.trim()}`;
    return;
  }
  await sql`update device_tokens set active = false, last_seen_at = now()
    where user_id = ${userId}`;
}

async function sendFcmToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  const serverKey = process.env.FCM_SERVER_KEY?.trim();
  if (!serverKey) return;
  const sql = await getSql();
  const tokens = await sql<{ id: string; token: string }>`
    select id, token from device_tokens where user_id = ${userId} and active = true`;
  if (tokens.length === 0) return;
  await Promise.all(
    tokens.map(async (row) => {
      try {
        const res = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            Authorization: `key=${serverKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: row.token,
            priority: "high",
            notification: {
              title: payload.title,
              body: payload.body,
              click_action: "FCM_PLUGIN_ACTIVITY",
              sound: "default",
            },
            data: {
              title: payload.title,
              body: payload.body,
              url: payload.url ?? "/",
              tag: payload.tag ?? "toranj",
            },
          }),
        });
        if (res.status === 404 || res.status === 410) {
          await sql`update device_tokens set active = false where id = ${row.id}`;
        }
      } catch (err) {
        console.error("[push] FCM send failed", err);
      }
    }),
  );
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  const sql = await getSql();
  const subs = await sql<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth_secret: string;
  }>`select id, endpoint, p256dh, auth_secret from push_subscriptions where user_id = ${userId}`;
  if (subs.length > 0) {
    try {
      const keys = await loadVapid();
      webpush.setVapidDetails("mailto:toranj@seller.toranj.ir", keys.publicKey, keys.privateKey);
      const body = JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/",
        tag: payload.tag ?? "toranj",
        lang: "fa",
        dir: "rtl",
      });
      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth_secret },
              },
              body,
              { TTL: 60 * 60 * 12, urgency: "high" },
            );
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await sql`delete from push_subscriptions where id = ${sub.id}`;
            }
          }
        }),
      );
    } catch (err) {
      console.error("[push] web-push failed", err);
    }
  }
  await sendFcmToUser(userId, payload);
}
