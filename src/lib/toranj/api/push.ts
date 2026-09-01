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
