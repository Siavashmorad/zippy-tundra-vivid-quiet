import { createFileRoute } from "@tanstack/react-router";
import { toFaError } from "@/lib/toranj/errors";

export const Route = createFileRoute("/api/public/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            shopCode?: string;
            firstName?: string;
            lastName?: string;
            phone?: string;
            address?: string;
          };
          const { registerCustomerFromApp } = await import("@/lib/toranj/server/customers");
          const result = await registerCustomerFromApp({
            shopCode: String(body.shopCode ?? ""),
            firstName: String(body.firstName ?? ""),
            lastName: String(body.lastName ?? ""),
            phone: String(body.phone ?? ""),
            address: body.address,
          });
          return Response.json({
            ok: true,
            created: result.created,
            customerId: result.customer.id,
            isNew: result.customer.isNew,
          });
        } catch (err) {
          return Response.json({ error: toFaError(err) }, { status: 400 });
        }
      },
    },
  },
});
