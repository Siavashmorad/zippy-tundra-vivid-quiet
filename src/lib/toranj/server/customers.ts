import { getSql } from "@/lib/db";
import { fail } from "../errors";
import { nid } from "../ids";
import { normalizeIranPhone } from "../phone";
import type { Customer } from "../types";
import { createNotification, emitShopEvent } from "./events";
import { mapCustomer } from "./map";
import { sendPushToUser } from "./push";
import { requireShopByOwner } from "./shop";

export async function listCustomers(
  userId: string,
  q = "",
): Promise<Customer[]> {
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  const query = q.trim();
  const rows = query
    ? await sql<Record<string, unknown>>`
        select * from customers
        where shop_id = ${shop.id}
          and (
            first_name ilike ${"%" + query + "%"}
            or last_name ilike ${"%" + query + "%"}
            or phone ilike ${"%" + query + "%"}
            or phone_normalized ilike ${"%" + query.replace(/\s/g, "") + "%"}
          )
        order by is_new desc, updated_at desc
        limit 400`
    : await sql<Record<string, unknown>>`
        select * from customers
        where shop_id = ${shop.id}
        order by is_new desc, updated_at desc
        limit 400`;
  return rows.map(mapCustomer);
}

export async function getCustomerForSeller(
  userId: string,
  customerId: string,
): Promise<Customer> {
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from customers where id = ${customerId} and shop_id = ${shop.id} limit 1`;
  if (!rows[0]) fail("مشتری پیدا نشد.", 404);
  return mapCustomer(rows[0]);
}

export async function findCustomerByPhone(
  shopId: string,
  phoneNormalized: string,
): Promise<Customer | null> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from customers
    where shop_id = ${shopId} and phone_normalized = ${phoneNormalized}
    limit 1`;
  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function insertCustomer(input: {
  shopId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
  source: string;
  isNew: boolean;
  notes?: string;
  userId?: string | null;
}): Promise<Customer> {
  const phone = normalizeIranPhone(input.phone);
  if (!phone) fail("شماره موبایل معتبر نیست.");
  const firstName = input.firstName.trim() || "مشتری";
  const lastName = input.lastName.trim();
  const existing = await findCustomerByPhone(input.shopId, phone);
  if (existing) return existing;
  const sql = await getSql();
  const id = nid("cus");
  try {
    await sql`insert into customers (
      id, shop_id, user_id, first_name, last_name, phone, phone_normalized,
      address, source, is_new, notes
    ) values (
      ${id}, ${input.shopId}, ${input.userId ?? null}, ${firstName}, ${lastName},
      ${phone}, ${phone}, ${input.address?.trim() ?? ""}, ${input.source},
      ${input.isNew}, ${input.notes?.trim() ?? ""}
    )`;
  } catch (err) {
    const again = await findCustomerByPhone(input.shopId, phone);
    if (again) return again;
    throw err;
  }
  const created = await findCustomerByPhone(input.shopId, phone);
  if (!created) fail("ثبت مشتری ناموفق بود.", 500);
  return created;
}

export async function upsertCustomerForSeller(
  userId: string,
  input: {
    id?: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
    notes?: string;
  },
): Promise<{ customer: Customer; created: boolean }> {
  const shop = await requireShopByOwner(userId);
  const phone = normalizeIranPhone(input.phone);
  if (!phone) fail("شماره موبایل معتبر نیست.");
  const firstName = input.firstName.trim();
  if (!firstName) fail("نام مشتری را وارد کنید.");
  const lastName = input.lastName.trim();
  const sql = await getSql();

  if (input.id) {
    const current = await getCustomerForSeller(userId, input.id);
    const clash = await findCustomerByPhone(shop.id, phone);
    if (clash && clash.id !== current.id) {
      fail("این شماره قبلاً برای مشتری دیگری ثبت شده است.");
    }
    await sql`update customers set
      first_name = ${firstName},
      last_name = ${lastName},
      phone = ${phone},
      phone_normalized = ${phone},
      address = ${input.address?.trim() ?? current.address},
      notes = ${input.notes?.trim() ?? current.notes},
      updated_at = now()
      where id = ${current.id} and shop_id = ${shop.id}`;
    const updated = await getCustomerForSeller(userId, current.id);
    await emitShopEvent(shop.id, "customer.updated", { customerId: updated.id });
    return { customer: updated, created: false };
  }

  const existing = await findCustomerByPhone(shop.id, phone);
  if (existing) {
    fail("این شماره قبلاً در فهرست مشتریان است.");
  }
  const created = await insertCustomer({
    shopId: shop.id,
    firstName,
    lastName,
    phone,
    address: input.address,
    notes: input.notes,
    source: "seller",
    isNew: false,
  });
  await emitShopEvent(shop.id, "customer.created", { customerId: created.id });
  return { customer: created, created: true };
}

export async function syncContactsForSeller(
  userId: string,
  contacts: { firstName: string; lastName: string; phone: string }[],
): Promise<{ added: number; skipped: number; customers: Customer[] }> {
  const shop = await requireShopByOwner(userId);
  let added = 0;
  let skipped = 0;
  const customers: Customer[] = [];
  for (const c of contacts) {
    const phone = normalizeIranPhone(c.phone);
    if (!phone) {
      skipped += 1;
      continue;
    }
    const existing = await findCustomerByPhone(shop.id, phone);
    if (existing) {
      skipped += 1;
      customers.push(existing);
      continue;
    }
    const created = await insertCustomer({
      shopId: shop.id,
      firstName: c.firstName.trim() || "مشتری",
      lastName: c.lastName.trim(),
      phone,
      source: "contacts",
      isNew: false,
    });
    added += 1;
    customers.push(created);
  }
  if (added > 0) {
    await emitShopEvent(shop.id, "customer.synced", { added, skipped });
  }
  return { added, skipped, customers };
}

export async function acknowledgeCustomer(
  userId: string,
  customerId: string,
): Promise<Customer> {
  const shop = await requireShopByOwner(userId);
  const sql = await getSql();
  await sql`update customers set is_new = false, last_seen_by_seller_at = now(), updated_at = now()
    where id = ${customerId} and shop_id = ${shop.id}`;
  return getCustomerForSeller(userId, customerId);
}

export async function registerCustomerFromApp(input: {
  shopCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
  userId?: string | null;
}): Promise<{ customer: Customer; created: boolean; shopId: string }> {
  const { requireShopByCode } = await import("./shop");
  const shop = await requireShopByCode(input.shopCode);
  const phone = normalizeIranPhone(input.phone);
  if (!phone) fail("شماره موبایل معتبر نیست.");
  const firstName = input.firstName.trim();
  if (!firstName) fail("نام را وارد کنید.");
  const existing = await findCustomerByPhone(shop.id, phone);
  const sql = await getSql();
  if (existing) {
    await sql`update customers set
      user_id = coalesce(user_id, ${input.userId ?? null}),
      address = case when ${input.address?.trim() ?? ""} = '' then address else ${input.address?.trim() ?? ""} end,
      first_name = case when first_name = 'مشتری' then ${firstName} else first_name end,
      last_name = case when last_name = '' then ${input.lastName.trim()} else last_name end,
      updated_at = now()
      where id = ${existing.id}`;
    const updated = (await findCustomerByPhone(shop.id, phone)) ?? existing;
    return { customer: updated, created: false, shopId: shop.id };
  }
  const created = await insertCustomer({
    shopId: shop.id,
    firstName,
    lastName: input.lastName,
    phone,
    address: input.address,
    source: "customer_app",
    isNew: true,
    userId: input.userId ?? null,
  });
  await emitShopEvent(shop.id, "customer.created", {
    customerId: created.id,
    source: "customer_app",
  });
  await createNotification({
    shopId: shop.id,
    userId: shop.ownerUserId,
    type: "customer.new",
    title: "مشتری جدید",
    body: `${created.firstName} ${created.lastName} از اپ مشتری ثبت‌نام کرد.`.trim(),
    payload: { customerId: created.id },
  });
  await sendPushToUser(shop.ownerUserId, {
    title: "مشتری جدید",
    body: `${created.firstName} از اپ مشتری ثبت‌نام کرد.`,
    url: "/?tab=customers",
    tag: `customer-${created.id}`,
  });
  return { customer: created, created: true, shopId: shop.id };
}
