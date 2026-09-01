import { getSql } from "@/lib/db";
import { fail } from "../errors";
import { nid } from "../ids";
import { customerFullName } from "../format";
import type { Message, Thread } from "../types";
import { getCustomerForSeller, findCustomerByPhone } from "./customers";
import { createNotification, emitShopEvent } from "./events";
import { mapCustomer, mapMessage } from "./map";
import { sendPushToUser } from "./push";
import { requireShopByCode, requireShopByOwner } from "./shop";
import { normalizeIranPhone } from "../phone";

export async function listThreads(userId: string, q = ""): Promise<Thread[]> {
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  const customers = q.trim()
    ? await sql<Record<string, unknown>>`
        select * from customers
        where shop_id = ${shop.id}
          and (
            first_name ilike ${"%" + q.trim() + "%"}
            or last_name ilike ${"%" + q.trim() + "%"}
            or phone ilike ${"%" + q.trim() + "%"}
          )
        order by updated_at desc
        limit 400`
    : await sql<Record<string, unknown>>`
        select * from customers
        where shop_id = ${shop.id}
        order by updated_at desc
        limit 400`;
  const lastRows = await sql<Record<string, unknown>>`
    select distinct on (customer_id) *
    from messages
    where shop_id = ${shop.id} and customer_id is not null
    order by customer_id, created_at desc`;
  const unreadRows = await sql<{ customer_id: string; n: number }>`
    select customer_id, count(*)::int as n
    from messages
    where shop_id = ${shop.id} and sender_role = 'customer' and read_at is null
    group by customer_id`;
  const lastBy = new Map(lastRows.map((r) => [String(r.customer_id), mapMessage(r)]));
  const unreadBy = new Map(unreadRows.map((r) => [r.customer_id, r.n]));
  const threads: Thread[] = customers.map((row) => {
    const customer = mapCustomer(row);
    return {
      customer,
      lastMessage: lastBy.get(customer.id) ?? null,
      unreadCount: unreadBy.get(customer.id) ?? 0,
    };
  });
  threads.sort((a, b) => {
    const at = a.lastMessage?.createdAt ?? a.customer.updatedAt;
    const bt = b.lastMessage?.createdAt ?? b.customer.updatedAt;
    return bt.localeCompare(at);
  });
  return threads;
}

export async function listMessagesForSeller(
  userId: string,
  customerId: string,
): Promise<Message[]> {
  const shop = await requireShopByOwner(userId);
  await getCustomerForSeller(userId, customerId);
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from messages
    where shop_id = ${shop.id} and customer_id = ${customerId}
    order by created_at asc
    limit 500`;
  return rows.map(mapMessage);
}

export async function sendSellerMessage(
  userId: string,
  customerId: string,
  body: string,
): Promise<Message> {
  const text = body.trim();
  if (!text) fail("متن پیام خالی است.");
  const shop = await requireShopByOwner(userId);
  const customer = await getCustomerForSeller(userId, customerId);
  const sql = await getSql();
  const id = nid("msg");
  await sql`insert into messages (id, shop_id, customer_id, sender_role, sender_user_id, body, delivered_at)
    values (${id}, ${shop.id}, ${customerId}, 'seller', ${userId}, ${text}, now())`;
  await sql`update customers set updated_at = now() where id = ${customerId}`;
  await emitShopEvent(shop.id, "message.created", {
    messageId: id,
    customerId,
    senderRole: "seller",
  });
  if (customer.userId) {
    await createNotification({
      shopId: shop.id,
      userId: customer.userId,
      type: "message.new",
      title: "پیام جدید از ترنج",
      body: text.slice(0, 120),
      payload: { customerId, messageId: id },
    });
    await sendPushToUser(customer.userId, {
      title: shop.name,
      body: text.slice(0, 120),
      url: "/c",
      tag: `msg-${customerId}`,
    });
  }
  const rows = await sql<Record<string, unknown>>`select * from messages where id = ${id} limit 1`;
  return mapMessage(rows[0]!);
}

export async function sendCustomerMessage(input: {
  shopCode: string;
  phone: string;
  body: string;
}): Promise<Message> {
  const text = input.body.trim();
  if (!text) fail("متن پیام خالی است.");
  const shop = await requireShopByCode(input.shopCode);
  const phone = normalizeIranPhone(input.phone);
  if (!phone) fail("شماره موبایل معتبر نیست.");
  const customer = await findCustomerByPhone(shop.id, phone);
  if (!customer) fail("ابتدا ثبت‌نام کنید.");
  const sql = await getSql();
  const id = nid("msg");
  await sql`insert into messages (id, shop_id, customer_id, sender_role, sender_user_id, body)
    values (${id}, ${shop.id}, ${customer.id}, 'customer', ${customer.userId}, ${text})`;
  await sql`update customers set updated_at = now() where id = ${customer.id}`;
  await emitShopEvent(shop.id, "message.created", {
    messageId: id,
    customerId: customer.id,
    senderRole: "customer",
  });
  await createNotification({
    shopId: shop.id,
    userId: shop.ownerUserId,
    type: "message.new",
    title: `پیام از ${customerFullName(customer.firstName, customer.lastName)}`,
    body: text.slice(0, 120),
    payload: { customerId: customer.id, messageId: id },
  });
  await sendPushToUser(shop.ownerUserId, {
    title: customerFullName(customer.firstName, customer.lastName),
    body: text.slice(0, 120),
    url: `/?tab=messages&customer=${customer.id}`,
    tag: `msg-${customer.id}`,
  });
  const rows = await sql<Record<string, unknown>>`select * from messages where id = ${id} limit 1`;
  return mapMessage(rows[0]!);
}

export async function markThreadRead(userId: string, customerId: string): Promise<void> {
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  await sql`update messages set read_at = now(), delivered_at = coalesce(delivered_at, now())
    where shop_id = ${shop.id} and customer_id = ${customerId}
      and sender_role = 'customer' and read_at is null`;
  await emitShopEvent(shop.id, "message.read", { customerId });
}

export async function searchMessages(userId: string, q: string): Promise<Message[]> {
  const shop = await requireShopByOwner(userId);
  const query = q.trim();
  if (!query) return [];
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from messages
    where shop_id = ${shop.id} and body ilike ${"%" + query + "%"}
    order by created_at desc
    limit 80`;
  return rows.map(mapMessage);
}

/** Backend-ready broadcast (not exposed in seller UI v1). */
export async function createBroadcast(
  userId: string,
  body: string,
  customerIds?: string[],
): Promise<{ broadcastId: string; recipientCount: number }> {
  const text = body.trim();
  if (!text) fail("متن پیام خالی است.");
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  const targets = customerIds?.length
    ? customerIds
    : (
        await sql<{ id: string }>`select id from customers where shop_id = ${shop.id}`
      ).map((r) => r.id);
  const broadcastId = nid("brd");
  await sql`insert into broadcasts (id, shop_id, body, created_by)
    values (${broadcastId}, ${shop.id}, ${text}, ${userId})`;
  for (const customerId of targets) {
    const msgId = nid("msg");
    await sql`insert into messages (id, shop_id, customer_id, sender_role, sender_user_id, body, delivered_at)
      values (${msgId}, ${shop.id}, ${customerId}, 'seller', ${userId}, ${text}, now())`;
    await sql`insert into broadcast_recipients (broadcast_id, customer_id, message_id)
      values (${broadcastId}, ${customerId}, ${msgId})`;
  }
  await emitShopEvent(shop.id, "broadcast.created", {
    broadcastId,
    recipientCount: targets.length,
  });
  return { broadcastId, recipientCount: targets.length };
}
