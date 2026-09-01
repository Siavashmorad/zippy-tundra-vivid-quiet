import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";

export const listSellerCustomers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ q: String((input as { q?: string } | undefined)?.q ?? "") }))
  .handler(async ({ context, data }) => {
    const { listCustomers } = await import("../server/customers");
    return listCustomers(context.userId, data.q ?? "");
  });

export const getSellerCustomer = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const { getCustomerForSeller } = await import("../server/customers");
    const { listOrdersForSeller } = await import("../server/orders");
    const customer = await getCustomerForSeller(context.userId, data.id);
    const orders = await listOrdersForSeller(context.userId, { customerId: data.id });
    return { customer, orders };
  });

export const saveCustomer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string().optional(),
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      address: z.string().optional(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { upsertCustomerForSeller } = await import("../server/customers");
    return upsertCustomerForSeller(context.userId, data);
  });

export const syncPhoneContacts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      contacts: z.array(
        z.object({
          firstName: z.string(),
          lastName: z.string(),
          phone: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const { syncContactsForSeller } = await import("../server/customers");
    return syncContactsForSeller(context.userId, data.contacts);
  });

export const markCustomerSeen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const { acknowledgeCustomer } = await import("../server/customers");
    return acknowledgeCustomer(context.userId, data.id);
  });
