import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";

export const getPushPublicKey = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { getVapidPublicKey } = await import("../server/push");
    return { publicKey: await getVapidPublicKey() };
  });

export const registerPushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { savePushSubscription } = await import("../server/push");
    await savePushSubscription({ userId: context.userId, ...data });
    return { ok: true };
  });

export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      token: z.string().min(8),
      platform: z.string().optional(),
      appRole: z.enum(["seller", "customer"]).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { saveDeviceToken } = await import("../server/push");
    await saveDeviceToken({
      userId: context.userId,
      token: data.token,
      platform: data.platform,
      appRole: data.appRole,
    });
    return { ok: true };
  });

export const unregisterDeviceToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ token: z.string().optional() }).optional())
  .handler(async ({ context, data }) => {
    const { deactivateDeviceToken } = await import("../server/push");
    await deactivateDeviceToken(context.userId, data?.token);
    return { ok: true };
  });
