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
  if (subs.length === 0) return;
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
}
