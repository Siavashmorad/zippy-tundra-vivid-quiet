import * as webpush from "web-push";
import { SignJWT, importPKCS8 } from "jose";
import { getSql } from "@/lib/db";
import { nid } from "../ids";

type Vapid = { publicKey: string; privateKey: string };
async function loadVapid(): Promise<Vapid> {
  const sql = await getSql(); const rows = await sql<{ value: string }>`select value from app_secrets where key = 'vapid' limit 1`;
  if (rows[0]?.value) {
    try { return JSON.parse(rows[0].value) as Vapid; }
    catch (err) { console.warn("[push] stored VAPID secret is invalid; generating a new key", err); }
  }
  const keys = webpush.generateVAPIDKeys();
  await sql`insert into app_secrets (key, value, updated_at) values ('vapid', ${JSON.stringify(keys)}, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return keys;
}
export async function getVapidPublicKey(): Promise<string> { return (await loadVapid()).publicKey; }
export async function savePushSubscription(input: { userId: string; endpoint: string; p256dh: string; auth: string }): Promise<void> {
  const sql = await getSql(); const id = nid("psh");
  await sql`insert into push_subscriptions (id, user_id, endpoint, p256dh, auth_secret) values (${id}, ${input.userId}, ${input.endpoint}, ${input.p256dh}, ${input.auth}) on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth_secret = excluded.auth_secret`;
}
export async function saveDeviceToken(input: { userId: string; token: string; platform?: string; appRole?: string }): Promise<void> {
  const sql = await getSql(); const token = input.token.trim(); if (!token) return; const id = nid("dvt");
  await sql`insert into device_tokens (id, user_id, token, platform, app_role, active, last_seen_at) values (${id}, ${input.userId}, ${token}, ${input.platform ?? "android"}, ${input.appRole ?? "seller"}, true, now()) on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, app_role = excluded.app_role, active = true, last_seen_at = now()`;
}
export async function deactivateDeviceToken(userId: string, token?: string): Promise<void> {
  const sql = await getSql();
  if (token?.trim()) { await sql`update device_tokens set active = false, last_seen_at = now() where user_id = ${userId} and token = ${token.trim()}`; return; }
  await sql`update device_tokens set active = false, last_seen_at = now() where user_id = ${userId}`;
}

async function getFcmAccess(raw: string | undefined): Promise<{ token: string; projectId: string } | null> {
  if (!raw?.trim()) return null;
  try {
    const account = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!account.project_id || !account.client_email || !account.private_key) return null;
    const key = await importPKCS8(account.private_key.replace(/\\n/g, "\n"), "RS256");
    const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(account.client_email).setSubject(account.client_email).setAudience("https://oauth2.googleapis.com/token").setIssuedAt().setExpirationTime("1h").sign(key);
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
    if (!response.ok) { console.error("[push] FCM OAuth failed", response.status); return null; }
    const data = await response.json() as { access_token?: string };
    return data.access_token ? { token: data.access_token, projectId: account.project_id } : null;
  } catch (err) { console.error("[push] FCM credentials invalid", err); return null; }
}

function getFcmSecretForRole(appRole: string | null | undefined): string | undefined {
  if (appRole === "customer") return process.env.FIREBASE_CUSTOMER_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return process.env.FIREBASE_SELLER_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}

async function sendFcmToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<void> {
  const sql = await getSql();
  const tokens = await sql<{ id: string; token: string; app_role: string | null }>`select id, token, app_role from device_tokens where user_id = ${userId} and active = true`;
  await Promise.all(tokens.map(async (row) => {
    const auth = await getFcmAccess(getFcmSecretForRole(row.app_role));
    if (!auth) return;
    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/messages:send`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token: row.token, notification: { title: payload.title, body: payload.body }, data: { title: payload.title, body: payload.body, url: payload.url ?? "/", tag: payload.tag ?? "toranj" }, android: { priority: "HIGH", notification: { channel_id: "toranj", sound: "default" } } } }) });
      if (res.status === 404 || res.status === 410) await sql`update device_tokens set active = false where id = ${row.id}`;
      if (!res.ok) console.error("[push] FCM send failed", res.status, await res.text());
    } catch (err) { console.error("[push] FCM send failed", err); }
  }));
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<void> {
  const sql = await getSql();
  const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth_secret: string }>`select id, endpoint, p256dh, auth_secret from push_subscriptions where user_id = ${userId}`;
  if (subs.length > 0) {
    try {
      const keys = await loadVapid(); webpush.setVapidDetails("mailto:toranj@toranj.ir", keys.publicKey, keys.privateKey);
      const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/", tag: payload.tag ?? "toranj", lang: "fa", dir: "rtl" });
      await Promise.all(subs.map(async (sub) => { try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } }, body, { TTL: 43200, urgency: "high" }); } catch (err) { const status = (err as { statusCode?: number }).statusCode; if (status === 404 || status === 410) await sql`delete from push_subscriptions where id = ${sub.id}`; } }));
    } catch (err) { console.error("[push] web-push failed", err); }
  }
  await sendFcmToUser(userId, payload);
}
