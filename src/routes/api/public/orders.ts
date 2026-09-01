import { createFileRoute } from "@tanstack/react-router";
import { toFaError } from "@/lib/toranj/errors";

export const Route = createFileRoute("/api/public/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            shopCode?: string;
            phone?: string;
            firstName?: string;
            lastName?: string;
            notes?: string;
            totalAmount?: number | null;
            items?: {
              name: string;
              weight?: number | null;
              quantity?: number | null;
              unit?: string;
              notes?: string;
            }[];
          };
          const { createOrderFromCustomer } = await import("@/lib/toranj/server/orders");
          const result = await createOrderFromCustomer({
            shopCode: String(body.shopCode ?? ""),
            phone: String(body.phone ?? ""),
            firstName: body.firstName,
            lastName: body.lastName,
            items: body.items ?? [],
            notes: body.notes,
            totalAmount: body.totalAmount,
          });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json({ error: toFaError(err) }, { status: 400 });
        }
      },
    },
  },
});
