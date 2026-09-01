import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string(),
  weight: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

export const listSellerOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const data = (input ?? {}) as { status?: string; customerId?: string; q?: string };
    return { status: data.status, customerId: data.customerId, q: data.q };
  })
  .handler(async ({ context, data }) => {
    const { listOrdersForSeller } = await import("../server/orders");
    return listOrdersForSeller(context.userId, data);
  });

export const getSellerOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const { getOrderForSeller } = await import("../server/orders");
    return getOrderForSeller(context.userId, data.id);
  });

export const createSellerOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      customerId: z.string(),
      items: z.array(itemSchema),
      notes: z.string().optional(),
      totalAmount: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { createWalkInOrder } = await import("../server/orders");
    return createWalkInOrder(context.userId, data);
  });

export const changeOrderStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), status: z.string() }))
  .handler(async ({ context, data }) => {
    const { setOrderStatus } = await import("../server/orders");
    return setOrderStatus(context.userId, data.id, data.status);
  });

export const changeOrderPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      paymentStatus: z.string(),
      totalAmount: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { setOrderPayment } = await import("../server/orders");
    return setOrderPayment(context.userId, data.id, data.paymentStatus, data.totalAmount);
  });

export const simulateCustomerOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      phone: z.string(),
      firstName: z.string(),
      lastName: z.string().optional(),
      items: z.array(itemSchema),
      notes: z.string().optional(),
      totalAmount: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { requireShopByOwner } = await import("../server/shop");
    const { createOrderFromCustomer } = await import("../server/orders");
    const shop = await requireShopByOwner(context.userId);
    return createOrderFromCustomer({
      shopCode: shop.publicCode,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      items: data.items,
      notes: data.notes,
      totalAmount: data.totalAmount,
    });
  });
