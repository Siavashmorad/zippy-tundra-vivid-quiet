import { getSql } from "@/lib/db";
import { PRESENCE_TTL_MS, SHOP_BRAND_NAME } from "../constants";
import { fail } from "../errors";
import { nid, makeShopCode } from "../ids";
import { SELLER_APP_VERSION } from "../version";
import type { CardInfo, SellerBootstrap, SellerProfile, Shop } from "../types";
import { liveOnline, mapCard, mapProfile, mapShop } from "./map";

export async function shopByOwner(userId: string): Promise<Shop | null> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from shops where owner_user_id = ${userId} limit 1`;
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function shopByCode(code: string): Promise<Shop | null> {
  const sql = await getSql();
  const trimmed = code.trim().toUpperCase();
  const rows = await sql<Record<string, unknown>>`
    select * from shops where public_code = ${trimmed} limit 1`;
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function requireShopByOwner(userId: string): Promise<Shop> {
  const shop = await shopByOwner(userId);
  if (!shop) fail("فروشگاه پیدا نشد. ابتدا وارد شوید.", 404);
  return shop;
}

export async function requireShopByCode(code: string): Promise<Shop> {
  const shop = await shopByCode(code);
  if (!shop) fail("کد فروشگاه نادرست است.");
  return shop;
}

export async function ensureShopForUser(
  userId: string,
  displayName: string,
  phone = "",
): Promise<{ shop: Shop; profile: SellerProfile }> {
  const sql = await getSql();
  const existing = await shopByOwner(userId);
  const name = displayName.trim() || SHOP_BRAND_NAME;
  if (existing) {
    const profiles = await sql<Record<string, unknown>>`
      select * from seller_profiles where user_id = ${userId} limit 1`;
    if (profiles[0]) return { shop: existing, profile: mapProfile(profiles[0]) };
    await sql`insert into seller_profiles (user_id, shop_id, display_name, phone)
      values (${userId}, ${existing.id}, ${name}, ${phone})`;
    return {
      shop: existing,
      profile: { userId, shopId: existing.id, displayName: name, phone },
    };
  }
  const id = nid("shp");
  let code = makeShopCode();
  for (let i = 0; i < 5; i += 1) {
    const clash = await sql`select 1 from shops where public_code = ${code} limit 1`;
    if (!clash[0]) break;
    code = makeShopCode();
  }
  await sql`insert into shops (id, owner_user_id, public_code, name, phone, is_online, last_seen_at)
    values (${id}, ${userId}, ${code}, ${name}, ${phone}, ${true}, now())`;
  await sql`insert into seller_profiles (user_id, shop_id, display_name, phone)
    values (${userId}, ${id}, ${name}, ${phone})`;
  await sql`insert into seller_card_information (shop_id) values (${id})`;
  const shop = await shopByOwner(userId);
  if (!shop) fail("ساخت فروشگاه ناموفق بود.", 500);
  return {
    shop,
    profile: { userId, shopId: shop.id, displayName: name, phone },
  };
}

export async function loadCard(shopId: string): Promise<CardInfo> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from seller_card_information where shop_id = ${shopId} limit 1`;
  if (rows[0]) return mapCard(rows[0]);
  await sql`insert into seller_card_information (shop_id) values (${shopId})`;
  return { shopId, holderName: "", cardNumber: "", bankName: "", extraInfo: "" };
}

export async function bootstrapSeller(
  userId: string,
  displayName: string,
): Promise<SellerBootstrap> {
  const { shop, profile } = await ensureShopForUser(userId, displayName);
  const sql = await getSql();
  const card = await loadCard(shop.id);
  const [newOrders] = await sql<{ n: number }>`
    select count(*)::int as n from orders where shop_id = ${shop.id} and status = 'new'`;
  const [unread] = await sql<{ n: number }>`
    select count(*)::int as n from messages
    where shop_id = ${shop.id} and sender_role = 'customer' and read_at is null`;
  const [newCustomers] = await sql<{ n: number }>`
    select count(*)::int as n from customers where shop_id = ${shop.id} and is_new = true`;
  const [unreadNtf] = await sql<{ n: number }>`
    select count(*)::int as n from notifications where user_id = ${userId} and read_at is null`;
  const versions = await sql<{ version: string; notes: string }>`
    select version, notes from app_versions where platform = 'seller' limit 1`;
  const latest = versions[0]?.version ?? SELLER_APP_VERSION;
  return {
    shop: {
      ...shop,
      isOnline: liveOnline(shop.isOnline, shop.lastSeenAt, PRESENCE_TTL_MS),
    },
    profile,
    card,
    newOrderCount: newOrders?.n ?? 0,
    unreadMessageCount: unread?.n ?? 0,
    newCustomerCount: newCustomers?.n ?? 0,
    unreadNotificationCount: unreadNtf?.n ?? 0,
    appVersion: SELLER_APP_VERSION,
    latestVersion: latest,
    updateNotes: versions[0]?.notes ?? "",
  };
}

export async function updateShopProfile(
  userId: string,
  input: { name?: string; phone?: string; displayName?: string },
): Promise<Shop> {
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  const name = (input.name ?? shop.name).trim() || shop.name;
  const phone = (input.phone ?? shop.phone).trim();
  const displayName = (input.displayName ?? name).trim() || name;
  await sql`update shops set name = ${name}, phone = ${phone}, updated_at = now() where id = ${shop.id} and owner_user_id = ${userId}`;
  await sql`update seller_profiles set display_name = ${displayName}, phone = ${phone}, updated_at = now() where user_id = ${userId}`;
  const next = await shopByOwner(userId);
  if (!next) fail("به‌روزرسانی فروشگاه ناموفق بود.", 500);
  return next;
}

export async function updateCardInfo(
  userId: string,
  input: { holderName: string; cardNumber: string; bankName: string; extraInfo: string },
): Promise<CardInfo> {
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  const holderName = input.holderName.trim();
  const cardNumber = input.cardNumber.replace(/\s+/g, "");
  const bankName = input.bankName.trim();
  const extraInfo = input.extraInfo.trim();
  await sql`insert into seller_card_information (shop_id, holder_name, card_number, bank_name, extra_info, updated_at)
    values (${shop.id}, ${holderName}, ${cardNumber}, ${bankName}, ${extraInfo}, now())
    on conflict (shop_id) do update set
      holder_name = excluded.holder_name,
      card_number = excluded.card_number,
      bank_name = excluded.bank_name,
      extra_info = excluded.extra_info,
      updated_at = now()`;
  return loadCard(shop.id);
}

export async function setPresence(userId: string, online: boolean): Promise<Shop> {
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  await sql`update shops set is_online = ${online}, last_seen_at = now(), updated_at = now()
    where id = ${shop.id} and owner_user_id = ${userId}`;
  const next = await shopByOwner(userId);
  if (!next) fail("به‌روزرسانی وضعیت ناموفق بود.", 500);
  return next;
}

export async function publicShopView(code: string) {
  const shop = await requireShopByCode(code);
  const card = await loadCard(shop.id);
  return {
    name: shop.name,
    publicCode: shop.publicCode,
    phone: shop.phone,
    isOnline: liveOnline(shop.isOnline, shop.lastSeenAt, PRESENCE_TTL_MS),
    lastSeenAt: shop.lastSeenAt,
    card: {
      holderName: card.holderName,
      cardNumber: card.cardNumber,
      bankName: card.bankName,
      extraInfo: card.extraInfo,
    },
  };
}
