import { getSql } from "@/lib/db";
import { fail } from "../errors";
import { nid } from "../ids";
import { customerFullName } from "../format";
import type { Message } from "../types";
import { mapCustomer, mapMessage } from "./map";
import { emitShopEvent } from "./events";
import { notifyUserSafe } from "./notify";
import { publicShopView } from "./shop";

export async function getCustomerChat(userId: string): Promise<{ customerId: string; shopCode: string; shopName: string; messages: Message[] }> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`select * from customers where user_id = ${userId} order by updated_at desc limit 1`;
  if (!rows[0]) fail("ابتدا ثبت‌نام مشتری را کامل کنید.");
  const customer = mapCustomer(rows[0]);
  const shopRows = await sql<{ public_code: string }>`select public_code from shops where id = ${customer.shopId} limit 1`;
  const shopCode = shopRows[0]?.public_code;
  if (!shopCode) fail("فروشگاه ترنج پیدا نشد.");
  const shop = await publicShopView(shopCode);
  const messages = await sql<Record<string, unknown>>`select * from messages where shop_id = ${customer.shopId} and customer_id = ${customer.id} order by created_at asc limit 500`;
  return { customerId: customer.id, shopCode, shopName: shop.name, messages: messages.map(mapMessage) };
}

export async function sendCustomerChatMessage(userId: string, body: string): Promise<Message> {
  const text = body.trim();
  if (!text) fail("متن پیام خالی است.");
  if (text.length > 2000) fail("متن پیام بیش از حد طولانی است.");
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`select * from customers where user_id = ${userId} order by updated_at desc limit 1`;
  if (!rows[0]) fail("ابتدا ثبت‌نام مشتری را کامل کنید.");
  const customer = mapCustomer(rows[0]);
  const shopRows = await sql<{ id: string; public_code: string; owner_user_id: string }>`select id, public_code, owner_user_id from shops where id = ${customer.shopId} limit 1`;
  const shop = shopRows[0];
  if (!shop) fail("فروشگاه ترنج پیدا نشد.");
  const id = nid("msg");
  await sql`insert into messages (id, shop_id, customer_id, sender_role, sender_user_id, body, delivered_at) values (${id}, ${shop.id}, ${customer.id}, 'customer', ${userId}, ${text}, now())`;
  await sql`update customers set updated_at = now() where id = ${customer.id}`;
  await emitShopEvent(shop.id, "message.created", { messageId: id, customerId: customer.id, senderRole: "customer" });
  await notifyUserSafe({ shopId: shop.id, userId: shop.owner_user_id, type: "message.new", title: "پیام جدید از مشتری", body: `${customerFullName(customer.firstName, customer.lastName)}: ${text.slice(0, 100)}`, payload: { customerId: customer.id, messageId: id }, url: `/?tab=messages&customer=${customer.id}`, tag: `msg-${customer.id}` });
  const result = await sql<Record<string, unknown>>`select * from messages where id = ${id} limit 1`;
  return mapMessage(result[0]!);
}

export async function markCustomerChatRead(userId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ id: string; shop_id: string }>`select id, shop_id from customers where user_id = ${userId} order by updated_at desc limit 1`;
  if (!rows[0]) return;
  await sql`update messages set read_at = now(), delivered_at = coalesce(delivered_at, now()) where shop_id = ${rows[0].shop_id} and customer_id = ${rows[0].id} and sender_role = 'seller' and read_at is null`;
  await emitShopEvent(rows[0].shop_id, "message.read", { customerId: rows[0].id });
}
