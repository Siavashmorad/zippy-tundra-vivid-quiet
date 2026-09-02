import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { z } from "zod";

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
  .handler(async ({ context, data }) => {
    const { listNotifications } = await import("../server/notifications");
    return listNotifications(context.userId, data?.limit ?? 80);
  });

export const getMyUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { countUnreadNotifications } = await import("../server/notifications");
    return countUnreadNotifications(context.userId);
  });

export const markMyNotificationRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ notificationId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { markNotificationRead } = await import("../server/notifications");
    await markNotificationRead(context.userId, data.notificationId);
    return { ok: true };
  });

export const markAllMyNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { markAllNotificationsRead } = await import("../server/notifications");
    await markAllNotificationsRead(context.userId);
    return { ok: true };
  });

export const deleteMyNotification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ notificationId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const { deleteNotification } = await import("../server/notifications");
    await deleteNotification(context.userId, data.notificationId);
    return { ok: true };
  });
