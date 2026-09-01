import { createFileRoute } from "@tanstack/react-router";
import { dbSource } from "@/lib/db";
import { SELLER_APP_VERSION } from "@/lib/toranj/version";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          await sql`select 1 as ok`;
          return Response.json({
            ok: true,
            app: "فروشنده ترنج",
            version: SELLER_APP_VERSION,
            db: dbSource,
          });
        } catch (err) {
          return Response.json(
            {
              ok: false,
              app: "فروشنده ترنج",
              version: SELLER_APP_VERSION,
              error: "ارتباط با پایگاه‌داده برقرار نشد.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
