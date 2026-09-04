import { getSql } from "@/lib/db";
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus, type Unit } from "../constants";
import { fail } from "../errors";
import { nid } from "../ids";
import { customerFullName, itemSummary } from "../format";
import type { Order, OrderItem } from "../types";
import { findCustomerByPhone, getCustomerForSeller, insertCustomer } from "./customers";
import { emitShopEvent } from "./events";
import { notifyUserSafe } from "./notify";
import { asIso, mapCustomer, mapItem } from "./map";
import { requireShopByCode, requireShopByOwner } from "./shop";
import { normalizeIranPhone } from "../phone";

type ItemInput = { name: string; weight?: number | null; quantity?: number | null; unit?: string; notes?: string };
function sanitizeItems(items: ItemInput[]): ItemInput[] {
  const out: ItemInput[] = [];
  for (const raw of items) {
    const name = String(raw.name ?? "").trim(); if (!name) continue;
    const weight = raw.weight == null || raw.weight === ("" as unknown) ? null : Number(raw.weight);
    const quantity = raw.quantity == null || raw.quantity === ("" as unknown) ? null : Number(raw.quantity);
    out.push({ name, weight: weight != null && Number.isFinite(weight) ? weight : null, quantity: quantity != null && Number.isFinite(quantity) ? quantity : null, unit: raw.unit?.trim() || "kg", notes: String(raw.notes ?? "").trim() });
  }
  if (out.length === 0) fail("حداقل یک قلم برای سفارش لازم است.");
  return out;
}
async function attachItems(orders: Order[]): Promise<Order[]> {
  if (orders.length === 0) return orders; const sql = await getSql(); const ids = orders.map((o) => o.id);
  const rows = await sql.query<Record<string, unknown>>(`select * from order_items where order_id = any($1::text[]) order by sort_order asc`, [ids]);
  const byOrder = new Map<string, OrderItem[]>(); for (const row of rows) { const item = mapItem(row); const list = byOrder.get(item.orderId) ?? []; list.push(item); byOrder.set(item.orderId, list); }
  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
}
function mapOrderRow(row: Record<string, unknown>): Order { return { id: String(row.id), shopId: String(row.shop_id), customerId: String(row.customer_id), status: String(row.status), notes: String(row.notes ?? ""), totalAmount: row.total_amount == null ? null : Number(row.total_amount), paymentStatus: String(row.payment_status ?? "unpaid"), source: String(row.source ?? "customer_app"), createdAt: asIso(row.created_at), updatedAt: asIso(row.updated_at), customerName: customerFullName(String(row.first_name ?? ""), String(row.last_name ?? "")), customerPhone: String(row.phone ?? ""), items: [] }; }

export async function listOrdersForSeller(userId: string, filter: { status?: string; customerId?: string; q?: string } = {}): Promise<Order[]> { const shop = await requireShopByOwner(userId); const sql = await getSql(); const status = filter.status && filter.status !== "all" ? filter.status : null; const customerId = filter.customerId || null; const q = filter.q?.trim() || null; const rows = await sql<Record<string, unknown>>`select o.*, c.first_name, c.last_name, c.phone from orders o join customers c on c.id = o.customer_id where o.shop_id = ${shop.id} and (${status}::text is null or o.status = ${status}) and (${customerId}::text is null or o.customer_id = ${customerId}) and (${q}::text is null or c.first_name ilike ${"%" + (q ?? "") + "%"} or c.last_name ilike ${"%" + (q ?? "") + "%"} or c.phone ilike ${"%" + (q ?? "") + "%"} or o.notes ilike ${"%" + (q ?? "") + "%"}) order by o.created_at desc limit 300`; return attachItems(rows.map(mapOrderRow)); }
export async function getOrderForSeller(userId: string, orderId: string): Promise<Order> { const shop = await requireShopByOwner(userId); const sql = await getSql(); const rows = await sql<Record<string, unknown>>`select o.*, c.first_name, c.last_name, c.phone from orders o join customers c on c.id = o.customer_id where o.id = ${orderId} and o.shop_id = ${shop.id} limit 1`; if (!rows[0]) fail("سفارش پیدا نشد.", 404); const [order] = await attachItems([mapOrderRow(rows[0])]); return order!; }
async function insertOrder(input: { shopId: string; customerId: string; items: ItemInput[]; notes: string; totalAmount: number | null; source: string; createdBy?: string | null }): Promise<string> { const sql = await getSql(); const id = nid("ord"); await sql`insert into orders (id, shop_id, customer_id, status, notes, total_amount, payment_status, source, created_by_user_id) values (${id}, ${input.shopId}, ${input.customerId}, 'new', ${input.notes}, ${input.totalAmount}, 'unpaid', ${input.source}, ${input.createdBy ?? null})`; for (let i = 0; i < input.items.length; i += 1) { const item = input.items[i]!; await sql`insert into order_items (id, order_id, name, weight, quantity, unit, notes, sort_order) values (${nid("itm")}, ${id}, ${item.name}, ${item.weight}, ${item.quantity}, ${item.unit ?? "kg"}, ${item.notes ?? ""}, ${i})`; } return id; }

export async function createWalkInOrder(userId: string, input: { customerId: string; items: ItemInput[]; notes?: string; totalAmount?: number | null }): Promise<Order> { const shop = await requireShopByOwner(userId); await getCustomerForSeller(userId, input.customerId); const items = sanitizeItems(input.items); const orderId = await insertOrder({ shopId: shop.id, customerId: input.customerId, items, notes: input.notes?.trim() ?? "", totalAmount: input.totalAmount ?? null, source: "seller", createdBy: userId }); await emitShopEvent(shop.id, "order.created", { orderId, source: "seller" }); return getOrderForSeller(userId, orderId); }

export async function createOrderFromCustomer(input: { shopCode: string; phone: string; firstName?: string; lastName?: string; userId?: string | null; items: ItemInput[]; notes?: string; totalAmount?: number | null }): Promise<{ orderId: string; shopId: string }> {
  const shop = await requireShopByCode(input.shopCode); const phone = normalizeIranPhone(input.phone); if (!phone) fail("شماره موبایل معتبر نیست."); const items = sanitizeItems(input.items);
  let customer = await findCustomerByPhone(shop.id, phone); let brandNew = false;
  if (!customer) { customer = await insertCustomer({ shopId: shop.id, firstName: input.firstName?.trim() || "مشتری", lastName: input.lastName?.trim() || "", phone, source: "customer_app", isNew: true, userId: input.userId ?? null }); brandNew = true; }
  else if (input.userId && customer.userId !== input.userId) {
    const sql = await getSql();
    await sql`update customers set user_id = ${input.userId}, updated_at = now() where id = ${customer.id} and shop_id = ${shop.id}`;
    customer = (await findCustomerByPhone(shop.id, phone)) ?? customer;
  }
  const orderId = await insertOrder({ shopId: shop.id, customerId: customer.id, items, notes: input.notes?.trim() ?? "", totalAmount: input.totalAmount ?? null, source: "customer_app" });
  const preview = items.slice(0, 3).map(itemSummary).join("، "); await emitShopEvent(shop.id, "order.created", { orderId, customerId: customer.id, source: "customer_app" });
  if (brandNew) await emitShopEvent(shop.id, "customer.created", { customerId: customer.id, source: "customer_app" });
  await notifyUserSafe({ shopId: shop.id, userId: shop.ownerUserId, type: "order.new", title: "سفارش جدید", body: `${customerFullName(customer.firstName, customer.lastName)}: ${preview}`, payload: { orderId, customerId: customer.id }, url: `/?tab=orders&order=${orderId}`, tag: `order-${orderId}` });
  return { orderId, shopId: shop.id };
}

export async function setOrderStatus(userId: string, orderId: string, status: string): Promise<Order> {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) fail("وضعیت سفارش نامعتبر است."); const current = await getOrderForSeller(userId, orderId); const shop = await requireShopByOwner(userId); const sql = await getSql();
  await sql`update orders set status = ${status}, updated_at = now() where id = ${orderId} and shop_id = ${shop.id}`;
  await sql`insert into order_status_events (id, order_id, shop_id, from_status, to_status, actor_user_id) values (${nid("ose")}, ${orderId}, ${shop.id}, ${current.status}, ${status}, ${userId})`;
  await emitShopEvent(shop.id, "order.updated", { orderId, from: current.status, to: status });
  const customerRows = await sql<Record<string, unknown>>`select * from customers where id = ${current.customerId} limit 1`; const customer = customerRows[0] ? mapCustomer(customerRows[0]) : null; const faStatus = STATUS_LABEL[status as OrderStatus] ?? status;
  if (customer) {
    const recipientUserId = customer.userId;
    if (recipientUserId) {
      const isCancel = status === "cancelled";
      const isConfirmed = status === "confirmed";
      const title = isCancel ? "لغو سفارش" : isConfirmed ? "تأیید سفارش" : "به‌روزرسانی سفارش";
      const body = isCancel ? "سفارش شما لغو شد." : isConfirmed ? "سفارش شما تأیید شد." : `وضعیت سفارش شما به «${faStatus}» تغییر کرد.`;
      await notifyUserSafe({ shopId: shop.id, userId: recipientUserId, type: isCancel ? "order.cancelled" : "order.status", title, body, payload: { orderId, status }, url: `/c?order=${encodeURIComponent(orderId)}`, tag: `order-${orderId}-${status}` });
    }
  }
  return getOrderForSeller(userId, orderId);
}
export async function setOrderPayment(userId: string, orderId: string, paymentStatus: string, totalAmount?: number | null): Promise<Order> { const shop = await requireShopByOwner(userId); await getOrderForSeller(userId, orderId); const sql = await getSql(); if (totalAmount == null) await sql`update orders set payment_status = ${paymentStatus}, updated_at = now() where id = ${orderId} and shop_id = ${shop.id}`; else await sql`update orders set payment_status = ${paymentStatus}, total_amount = ${totalAmount}, updated_at = now() where id = ${orderId} and shop_id = ${shop.id}`; await emitShopEvent(shop.id, "order.updated", { orderId, paymentStatus }); return getOrderForSeller(userId, orderId); }
export async function recordPayment(input: { shopId: string; orderId?: string | null; customerId?: string | null; amount?: number | null; receiptNote?: string; receiptImageUrl?: string | null; status?: string }): Promise<string> { const sql = await getSql(); const id = nid("pay"); await sql`insert into payments (id, shop_id, order_id, customer_id, amount, method, status, receipt_note, receipt_image_url) values (${id}, ${input.shopId}, ${input.orderId ?? null}, ${input.customerId ?? null}, ${input.amount ?? null}, 'card_to_card', ${input.status ?? "pending"}, ${input.receiptNote ?? ""}, ${input.receiptImageUrl ?? null})`; await emitShopEvent(input.shopId, "payment.created", { paymentId: id, orderId: input.orderId }); return id; }
export type { ItemInput, Unit };
