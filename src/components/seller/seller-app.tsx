import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Settings } from "lucide-react";
import { getBearerToken } from "@/lib/auth/client";
import type { AppUser } from "@/lib/auth/use-current-user";
import { getSellerState, heartbeat, listNotifications, markNotificationsRead } from "@/lib/toranj/api/shop";
import {
  deleteMyNotification,
  markMyNotificationRead,
} from "@/lib/toranj/api/notifications";
import { HEARTBEAT_MS } from "@/lib/toranj/constants";
import { toFaError } from "@/lib/toranj/errors";
import { relativeTime } from "@/lib/toranj/format";
import { pingNewOrder } from "@/lib/toranj/client/sound";
import { registerSw } from "@/lib/toranj/client/push";
import { ToranjMark } from "@/components/brand/toranj-mark";
import { CustomersTab } from "./customers-tab";
import { MessagesTab } from "./messages-tab";
import { OrdersTab } from "./orders-tab";
import { SettingsPanel } from "./settings-panel";
import { toast } from "sonner";

type Tab = "orders" | "customers" | "messages";

export function SellerApp({
  user,
  initialTab,
  initialOrder,
  initialCustomer,
}: {
  user: AppUser;
  initialTab?: Tab;
  initialOrder?: string;
  initialCustomer?: string;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab ?? "orders");
  const [orderId, setOrderId] = useState(initialOrder);
  const [customerId, setCustomerId] = useState(initialCustomer);
  const [settings, setSettings] = useState(false);
  const [notifs, setNotifs] = useState(false);
  const [connected, setConnected] = useState(true);
  const [net, setNet] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const lastOrderCount = useRef<number | null>(null);
  const lastEventId = useRef(0);
  const seenEventIds = useRef(new Set<number>());

  const state = useQuery({
    queryKey: ["seller-state"],
    queryFn: () => getSellerState(),
    refetchInterval: 12_000,
  });

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    enabled: notifs,
  });

  const refreshAll = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["seller-state"] });
    void qc.invalidateQueries({ queryKey: ["orders"] });
    void qc.invalidateQueries({ queryKey: ["customers"] });
    void qc.invalidateQueries({ queryKey: ["threads"] });
    void qc.invalidateQueries({ queryKey: ["messages"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  }, [qc]);

  useEffect(() => {
    void registerSw();
  }, []);

  useEffect(() => {
    const on = () => setNet(true);
    const off = () => setNet(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const beat = async (online: boolean) => {
      try {
        await heartbeat({ data: { online } });
      } catch {
        /* ignore heartbeat failure */
      }
    };
    void beat(true);
    const timer = window.setInterval(() => void beat(!document.hidden), HEARTBEAT_MS);
    const vis = () => {
      void beat(!document.hidden);
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", () => void beat(false));
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", vis);
      if (!stop) void beat(false);
    };
  }, []);

  useEffect(() => {
    let closed = false;
    const abort = new AbortController();
    async function connect() {
      while (!closed) {
        try {
          const headers: Record<string, string> = {};
          const token = getBearerToken();
          if (token) headers.Authorization = `Bearer ${token}`;
          const after = lastEventId.current;
          const res = await fetch(`/api/events?after=${after}`, {
            headers,
            signal: abort.signal,
          });
          if (!res.ok || !res.body) throw new Error("sse");
          setConnected(true);
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          while (!closed) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const chunks = buf.split("\n\n");
            buf = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const line = chunk.split("\n").find((l) => l.startsWith("data:"));
              if (!line) continue;
              const ev = JSON.parse(line.slice(5).trim()) as {
                type?: string;
                id?: number;
              };
              if (typeof ev.id === "number" && ev.id > 0) {
                if (seenEventIds.current.has(ev.id)) continue;
                seenEventIds.current.add(ev.id);
                if (seenEventIds.current.size > 400) {
                  const keep = [...seenEventIds.current].sort((a, b) => a - b).slice(-200);
                  seenEventIds.current = new Set(keep);
                }
                if (ev.id > lastEventId.current) lastEventId.current = ev.id;
              }
              if (ev.type && ev.type !== "hello") {
                if (ev.type === "order.created") pingNewOrder();
                if (ev.type === "order.created" || ev.type === "order.updated") {
                  void qc.invalidateQueries({ queryKey: ["orders"] });
                  void qc.invalidateQueries({ queryKey: ["seller-state"] });
                  void qc.invalidateQueries({ queryKey: ["notifications"] });
                } else if (
                  ev.type === "customer.created" ||
                  ev.type === "customer.updated" ||
                  ev.type === "customer.synced"
                ) {
                  void qc.invalidateQueries({ queryKey: ["customers"] });
                  void qc.invalidateQueries({ queryKey: ["seller-state"] });
                } else if (
                  ev.type === "message.created" ||
                  ev.type === "message.read" ||
                  ev.type === "broadcast.created"
                ) {
                  void qc.invalidateQueries({ queryKey: ["threads"] });
                  void qc.invalidateQueries({ queryKey: ["messages"] });
                  void qc.invalidateQueries({ queryKey: ["seller-state"] });
                  void qc.invalidateQueries({ queryKey: ["notifications"] });
                } else {
                  refreshAll();
                }
              }
            }
          }
        } catch {
          if (closed || abort.signal.aborted) return;
          setConnected(false);
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
    }
    void connect();
    return () => {
      closed = true;
      abort.abort();
    };
  }, [qc, refreshAll]);

  useEffect(() => {
    const n = state.data?.newOrderCount;
    if (typeof n === "number") {
      if (lastOrderCount.current != null && n > lastOrderCount.current) {
        pingNewOrder();
        toast.message("سفارش جدید رسید");
      }
      lastOrderCount.current = n;
    }
  }, [state.data?.newOrderCount]);

  if (state.isPending && !state.data) {
    return <Splash />;
  }
  if (state.isError && !state.data) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="font-semibold">اتصال به سرور برقرار نشد</p>
          <p className="mt-2 text-sm text-ink-soft">{toFaError(state.error)}</p>
          <button
            type="button"
            className="mt-4 h-11 rounded-xl bg-brand px-4 text-sm text-brand-fg"
            onClick={() => void state.refetch()}
          >
            تلاش دوباره
          </button>
        </div>
      </main>
    );
  }
  const bootstrap = state.data;
  if (!bootstrap) return <Splash />;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "orders", label: "سفارش‌ها", badge: bootstrap.newOrderCount || undefined },
    { id: "customers", label: "مشتری‌ها", badge: bootstrap.newCustomerCount || undefined },
    { id: "messages", label: "پیام‌ها", badge: bootstrap.unreadMessageCount || undefined },
  ];

  function openNotification(n: {
    id: string;
    type: string;
    payload: Record<string, string>;
  }) {
    void markMyNotificationRead({ data: { notificationId: n.id } }).then(() => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["seller-state"] });
    });
    const order = n.payload.orderId;
    const customer = n.payload.customerId;
    if (n.type.startsWith("order") && order) {
      setTab("orders");
      setOrderId(order);
      setNotifs(false);
      return;
    }
    if (n.type.startsWith("message") && customer) {
      setTab("messages");
      setCustomerId(customer);
      setNotifs(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-paper">
      {!net || !connected ? (
        <div className="bg-warn px-4 py-2 text-center text-xs text-paper">
          {!net
            ? "اینترنت قطع است. پس از وصل شدن، سفارش‌ها همگام می‌شوند."
            : "ارتباط لحظه‌ای قطع شد. در حال اتصال دوباره…"}
        </div>
      ) : null}
      <header className="flex items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="grid size-11 place-items-center rounded-2xl bg-brand text-brand-fg">
          <ToranjMark className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold">{bootstrap.shop.name}</h1>
            <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
              <span
                className={`size-2 rounded-full ${bootstrap.shop.isOnline ? "bg-online" : "bg-ink-faint"}`}
              />
              {bootstrap.shop.isOnline ? "آنلاین" : "آفلاین"}
            </span>
          </div>
          <p className="truncate text-xs text-ink-faint">
            {user.displayName ?? "فروشنده"} · فروشنده ترنج
          </p>
        </div>
        <button
          type="button"
          className="relative grid size-11 place-items-center rounded-xl hover:bg-paper-2"
          onClick={() => {
            setNotifs((v) => !v);
            void markNotificationsRead().then(() =>
              qc.invalidateQueries({ queryKey: ["seller-state"] }),
            );
          }}
          aria-label="اعلان‌ها"
        >
          <Bell className="size-5" />
          {bootstrap.unreadNotificationCount > 0 ? (
            <span className="absolute top-2 left-2 size-2 rounded-full bg-brand" />
          ) : null}
        </button>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl hover:bg-paper-2"
          onClick={() => setSettings(true)}
          aria-label="تنظیمات"
        >
          <Settings className="size-5" />
        </button>
      </header>

      <nav className="mx-4 grid grid-cols-3 rounded-2xl bg-paper-2 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id !== "orders") setOrderId(undefined);
              if (t.id !== "messages" && t.id !== "customers") setCustomerId(undefined);
            }}
            className={`relative h-11 rounded-xl text-sm font-medium ${tab === t.id ? "bg-surface text-ink shadow-card" : "text-ink-soft"}`}
          >
            {t.label}
            {t.badge ? (
              <span className="absolute top-1 left-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] text-brand-fg">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {notifs ? (
        <div className="mx-4 mt-3 max-h-64 overflow-y-auto rounded-2xl bg-surface p-3 shadow-card">
          {(notifications.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-soft">اعلانی نیست.</p>
          ) : (
            <ul className="space-y-2">
              {notifications.data!.map((n) => (
                <li key={n.id} className="border-b border-line pb-2 text-sm last:border-0">
                  <button type="button" className="w-full text-right" onClick={() => openNotification(n)}>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-ink-soft">{n.body}</p>
                    <p className="text-[11px] text-ink-faint">{relativeTime(n.createdAt)}</p>
                  </button>
                  <button
                    type="button"
                    className="mt-1 text-xs text-brand"
                    onClick={() =>
                      void deleteMyNotification({ data: { notificationId: n.id } }).then(() =>
                        qc.invalidateQueries({ queryKey: ["notifications"] }),
                      )
                    }
                  >
                    حذف
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {tab === "orders" ? (
          <OrdersTab selectedId={orderId} onSelect={setOrderId} />
        ) : tab === "customers" ? (
          <CustomersTab
            selectedId={customerId}
            onSelect={setCustomerId}
            onMessage={(id) => {
              setCustomerId(id);
              setTab("messages");
            }}
          />
        ) : (
          <MessagesTab selectedId={customerId} onSelect={setCustomerId} />
        )}
      </div>

      <SettingsPanel open={settings} onClose={() => setSettings(false)} state={bootstrap} />
    </div>
  );
}

export function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper">
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-[1.6rem] bg-brand text-brand-fg">
          <ToranjMark className="size-10" />
        </div>
        <p className="mt-4 font-semibold">فروشنده ترنج</p>
        <p className="text-sm text-ink-soft">در حال بارگذاری…</p>
      </div>
    </main>
  );
}
