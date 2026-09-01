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
        } catch (error) {
          // Never expose DATABASE_URL, credentials, or driver error text.
          // Keep a safe diagnostic so Production can distinguish a missing
          // DATABASE_URL (PGLite fallback) from a failed Neon connection.
          const reason = dbSource === "neon" ? "neon_connection_failed" : "database_url_missing";
          console.error("[health] database check failed", {
            db: dbSource,
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json(
            {
              ok: false,
              app: "فروشنده ترنج",
              version: SELLER_APP_VERSION,
              db: dbSource,
              reason,
              error: "ارتباط با پایگاه‌داده برقرار نشد.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
