import { createFileRoute } from "@tanstack/react-router";
import { toFaError } from "@/lib/toranj/errors";

export const Route = createFileRoute("/api/public/messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            shopCode?: string;
            phone?: string;
            body?: string;
          };
          const { sendCustomerMessage } = await import("@/lib/toranj/server/messages");
          const message = await sendCustomerMessage({
            shopCode: String(body.shopCode ?? ""),
            phone: String(body.phone ?? ""),
            body: String(body.body ?? ""),
          });
          return Response.json({ ok: true, message });
        } catch (err) {
          return Response.json({ error: toFaError(err) }, { status: 400 });
        }
      },
    },
  },
});
