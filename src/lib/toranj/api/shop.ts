import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";
import { SELLER_APP_VERSION } from "../version";

const cardSchema = z.object({
  holderName: z.string(),
  cardNumber: z.string(),
  bankName: z.string(),
  extraInfo: z.string(),
});

export const getSellerState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { bootstrapSeller } = await import("../server/shop");
    return bootstrapSeller(context.userId, "فروشنده ترنج");
  });

export const saveShopProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      displayName: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { updateShopProfile } = await import("../server/shop");
    return updateShopProfile(context.userId, data);
  });

export const saveCardInfo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(cardSchema)
  .handler(async ({ context, data }) => {
    const { updateCardInfo } = await import("../server/shop");
    return updateCardInfo(context.userId, data);
  });

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ online: z.boolean() }))
  .handler(async ({ context, data }) => {
    const { setPresence } = await import("../server/shop");
    return setPresence(context.userId, data.online);
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const { mapNotification } = await import("../server/map");
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from notifications
      where user_id = ${context.userId}
      order by created_at desc
      limit 50`;
    return rows.map(mapNotification);
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`update notifications set read_at = now()
      where user_id = ${context.userId} and read_at is null`;
    return { ok: true };
  });

export const getAppVersion = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ version: string; min_version: string; notes: string }>`
    select version, min_version, notes from app_versions where platform = 'seller' limit 1`;
  return {
    current: SELLER_APP_VERSION,
    latest: rows[0]?.version ?? SELLER_APP_VERSION,
    min: rows[0]?.min_version ?? SELLER_APP_VERSION,
    notes: rows[0]?.notes ?? "",
  };
});
