import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";

export const listSellerThreads = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ q: String((input as { q?: string } | undefined)?.q ?? "") }))
  .handler(async ({ context, data }) => {
    const { listThreads } = await import("../server/messages");
    return listThreads(context.userId, data.q ?? "");
  });

export const listSellerMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ customerId: z.string() }))
  .handler(async ({ context, data }) => {
    const { listMessagesForSeller } = await import("../server/messages");
    return listMessagesForSeller(context.userId, data.customerId);
  });

export const sendSellerChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ customerId: z.string(), body: z.string() }))
  .handler(async ({ context, data }) => {
    const { sendSellerMessage } = await import("../server/messages");
    return sendSellerMessage(context.userId, data.customerId, data.body);
  });

export const readSellerThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ customerId: z.string() }))
  .handler(async ({ context, data }) => {
    const { markThreadRead } = await import("../server/messages");
    await markThreadRead(context.userId, data.customerId);
    return { ok: true };
  });

export const searchSellerMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ q: z.string() }))
  .handler(async ({ context, data }) => {
    const { searchMessages } = await import("../server/messages");
    return searchMessages(context.userId, data.q);
  });
