import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getSessionUser } = await import("@/lib/auth/verify.server");
        const { shopByOwner } = await import("@/lib/toranj/server/shop");
        const { listEventsSince } = await import("@/lib/toranj/server/events");
        const { asIso } = await import("@/lib/toranj/server/map");
        const header = request.headers.get("authorization");
        const bearer = header?.toLowerCase().startsWith("bearer ")
          ? header.slice(7).trim()
          : undefined;
        const user = await getSessionUser(bearer);
        if (!user) {
          return Response.json({ error: "برای ادامه وارد حساب شوید." }, { status: 401 });
        }
        const shop = await shopByOwner(user.id);
        if (!shop) {
          return Response.json({ error: "فروشگاه پیدا نشد." }, { status: 404 });
        }
        const url = new URL(request.url);
        let lastId = Number(url.searchParams.get("after") ?? "0") || 0;
        const encoder = new TextEncoder();
        let closed = false;
        const stream = new ReadableStream({
          async start(controller) {
            const send = (obj: unknown) => {
              if (closed) return;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            };
            send({ type: "hello", shopId: shop.id, createdAt: new Date().toISOString() });
            const started = Date.now();
            try {
              while (!closed && !request.signal.aborted && Date.now() - started < 50_000) {
                const events = await listEventsSince(shop.id, lastId, 40);
                for (const ev of events) {
                  lastId = Number(ev.id);
                  let payload: Record<string, unknown> = {};
                  try {
                    payload = JSON.parse(ev.payload) as Record<string, unknown>;
                  } catch {
                    payload = {};
                  }
                  send({
                    id: lastId,
                    shopId: ev.shop_id,
                    type: ev.type,
                    payload,
                    createdAt: asIso(ev.created_at),
                  });
                }
                await new Promise((r) => setTimeout(r, 1200));
              }
            } catch {
              /* client gone */
            } finally {
              closed = true;
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
          },
          cancel() {
            closed = true;
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
