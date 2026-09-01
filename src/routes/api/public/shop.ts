import { createFileRoute } from "@tanstack/react-router";
import { toFaError } from "@/lib/toranj/errors";

export const Route = createFileRoute("/api/public/shop")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code") ?? "";
          const { publicShopView } = await import("@/lib/toranj/server/shop");
          return Response.json(await publicShopView(code));
        } catch (err) {
          return Response.json({ error: toFaError(err) }, { status: 400 });
        }
      },
    },
  },
});
