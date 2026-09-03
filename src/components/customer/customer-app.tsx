import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBearerToken, signOut } from "@/lib/auth/client";
import { getCustomerState, listCustomerOrders, registerCustomer, createCustomerOrder } from "@/lib/toranj/api/customer";
import { deleteMyNotification, getMyUnreadNotificationCount, listMyNotifications, markAllMyNotificationsRead, markMyNotificationRead } from "@/lib/toranj/api/notifications";
import { formatDateTime, formatToman, itemSummary, relativeTime, statusLabel } from "@/lib/toranj/format";

type Tab = "سفارش" | "تاریخچه" | "اعلان‌ها" | "حساب من";
type Item = { name: string; weight: number | null; quantity: number | null; unit: string; notes: string };
type CustomerState = { customer: { firstName: string; lastName: string; phone: string; address: string } | null; shop: { name: string; publicCode: string; phone: string; isOnline: boolean; lastSeenAt: string | null; card: { holderName: string; cardNumber: string; bankName: string; extraInfo: string } } };
type CustomerOrder = { id: string; status: string; notes: string; totalAmount: number | null; paymentStatus: string; createdAt: string; items: Array<{ name: string; weight: number | null; quantity: number | null; unit: string; notes: string }> };
type Notif = { id: string; type: string; title: string; body: string; payload: Record<string, unknown>; readAt: string | null; createdAt: string };

export function CustomerApp() {
  const [tab, setTab] = useState<Tab>("سفارش");
  const [state, setState] = useState<CustomerState | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([{ name: "", weight: null, quantity: null, unit: "kg", notes: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastEventId = useRef(0);
  const seenEventIds = useRef(new Set<number>());

  const refreshNotifs = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([listMyNotifications({ data: { limit: 80 } }), getMyUnreadNotificationCount()]);
      setNotifs(list as Notif[]); setUnread(count.count);
    } catch { /* ignore logged-out/reconnect edge */ }
  }, []);

  async function refresh() {
    try {
      setError("");
      const [next, history] = await Promise.all([getCustomerState(), listCustomerOrders()]);
      setState(next as CustomerState); setOrders(history as CustomerOrder[]); await refreshNotifs();
    } catch (e) { setError(e instanceof Error ? e.message : "ارتباط با سرور برقرار نشد."); }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    let closed = false;
    let abort: AbortController | null = null;
    async function connect() {
      while (!closed) {
        abort = new AbortController();
        try {
          const headers: Record<string, string> = {};
          const token = getBearerToken(); if (token) headers.Authorization = `Bearer ${token}`;
          const res = await fetch(`/api/events?after=${lastEventId.current}`, { headers, signal: abort.signal });
          if (!res.ok || !res.body) throw new Error("sse");
          const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
          while (!closed) {
            const { done, value } = await reader.read(); if (done) break;
            buf += dec.decode(value, { stream: true }); const chunks = buf.split("\n\n"); buf = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const line = chunk.split("\n").find((l) => l.startsWith("data:")); if (!line) continue;
              const ev = JSON.parse(line.slice(5).trim()) as { type?: string; id?: number };
              if (typeof ev.id === "number" && ev.id > 0) {
                if (seenEventIds.current.has(ev.id)) continue;
                seenEventIds.current.add(ev.id);
                if (seenEventIds.current.size > 400) { const keep = [...seenEventIds.current].sort((a, b) => a - b).slice(-200); seenEventIds.current = new Set(keep); }
                if (ev.id > lastEventId.current) lastEventId.current = ev.id;
              }
              if (ev.type === "notification.created") void refreshNotifs();
            }
          }
        } catch {
          if (closed || abort.signal.aborted) return;
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
    }
    void connect(); return () => { closed = true; abort?.abort(); };
  }, [refreshNotifs]);

  const cleanItems = useMemo(() => items.filter((x) => x.name.trim()), [items]);
  function updateItem(index: number, patch: Partial<Item>) { setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item))); }
  async function sendOrder() {
    if (!cleanItems.length) { setError("حداقل یک کالا وارد کنید."); return; }
    setBusy(true); setError("");
    try { await createCustomerOrder({ data: { items: cleanItems, notes: "" } }); setItems([{ name: "", weight: null, quantity: null, unit: "kg", notes: "" }]); setTab("تاریخچه"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "ارسال سفارش ناموفق بود."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper pb-24">
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur"><div className="flex items-center justify-between"><div><h1 className="text-lg font-bold">مشتری ترنج</h1><p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft"><span className={`size-2 rounded-full ${state?.shop.isOnline ? "bg-green-500" : "bg-gray-400"}`} />{state?.shop.isOnline ? "فروشنده آنلاین است" : "فروشنده آفلاین است"}</p></div><button className="text-xs text-ink-soft" onClick={() => void refresh()}>به‌روزرسانی</button></div></header>
    <section className="flex-1 px-4 py-4">{error && <div className="mb-3 rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">{error}</div>}{tab === "سفارش" && <OrderTab items={items} updateItem={updateItem} addItem={() => setItems((x) => [...x, { name: "", weight: null, quantity: null, unit: "kg", notes: "" }])} removeItem={(i) => setItems((x) => x.filter((_, n) => n !== i))} send={sendOrder} busy={busy} />}{tab === "تاریخچه" && <HistoryTab orders={orders} />}{tab === "اعلان‌ها" && <NotificationsTab items={notifs} onRefresh={refreshNotifs} onOpenOrder={() => setTab("تاریخچه")} />}{tab === "حساب من" && <AccountTab state={state} onSaved={refresh} onLogout={() => void signOut("/customer-login" as never)} />}</section>
    <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-4 border-t border-line bg-surface/95 backdrop-blur">{(["سفارش", "تاریخچه", "اعلان‌ها", "حساب من"] as const).map((name) => <button key={name} className={`relative py-3 text-sm font-medium ${tab === name ? "text-brand" : "text-ink-soft"}`} onClick={() => setTab(name)}>{name}{name === "اعلان‌ها" && unread > 0 ? <span className="absolute top-1 left-1/2 grid min-w-4 -translate-x-1/2 place-items-center rounded-full bg-brand px-1 text-[10px] text-brand-fg">{unread}</span> : null}</button>)}</nav>
  </main>;
}

function OrderTab({ items, updateItem, addItem, removeItem, send, busy }: { items: Item[]; updateItem: (i: number, p: Partial<Item>) => void; addItem: () => void; removeItem: (i: number) => void; send: () => void; busy: boolean }) { return <div className="space-y-3"><div className="rounded-2xl bg-surface p-4 shadow-card"><h2 className="font-semibold">لیست خرید</h2><p className="mt-1 text-xs text-ink-soft">کالاها و مقدار موردنیاز را وارد کنید.</p></div>{items.map((item, i) => <div key={i} className="rounded-2xl bg-surface p-3 shadow-card"><div className="flex gap-2"><input className="h-11 flex-1 rounded-xl border border-line bg-paper px-3" placeholder="نام کالا" value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} /><button type="button" className="text-xs text-brand" onClick={() => removeItem(i)}>حذف</button></div><div className="mt-2 grid grid-cols-3 gap-2"><input className="h-10 rounded-xl border border-line bg-paper px-2" inputMode="decimal" placeholder="وزن" value={item.weight ?? ""} onChange={(e) => updateItem(i, { weight: e.target.value ? Number(e.target.value) : null })} /><input className="h-10 rounded-xl border border-line bg-paper px-2" inputMode="numeric" placeholder="تعداد" value={item.quantity ?? ""} onChange={(e) => updateItem(i, { quantity: e.target.value ? Number(e.target.value) : null })} /><select className="h-10 rounded-xl border border-line bg-paper px-2" value={item.unit} onChange={(e) => updateItem(i, { unit: e.target.value })}><option value="kg">کیلو</option><option value="piece">عدد</option><option value="box">جعبه</option><option value="pack">بسته</option></select></div></div>)}<button type="button" className="w-full rounded-xl border border-line py-3 text-sm" onClick={addItem}>+ افزودن کالا</button><button type="button" disabled={busy} className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-fg disabled:opacity-60" onClick={() => void send()}>{busy ? "در حال ارسال…" : "ارسال سفارش به ترنج"}</button></div>; }
function HistoryTab({ orders }: { orders: CustomerOrder[] }) { return <div className="space-y-3"><h2 className="text-lg font-bold">تاریخچه سفارش‌ها</h2>{orders.length === 0 ? <div className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-soft">هنوز سفارشی ثبت نشده است.</div> : orders.map((o) => <article key={o.id} className="rounded-2xl bg-surface p-4 shadow-card"><div className="flex justify-between gap-3"><div><div className="font-semibold">سفارش {o.id.slice(-6)}</div><div className="mt-1 text-xs text-ink-soft">{formatDateTime(o.createdAt)}</div></div><div className="text-left text-sm">{statusLabel(o.status)}</div></div><ul className="mt-3 space-y-1 text-sm">{o.items.map((item, i) => <li key={i}>• {itemSummary(item)}</li>)}</ul><div className="mt-3 border-t border-line pt-3 font-semibold">{formatToman(o.totalAmount)}</div></article>)}</div>; }
function NotificationsTab({ items, onRefresh, onOpenOrder }: { items: Notif[]; onRefresh: () => Promise<void>; onOpenOrder: () => void }) { return <div className="space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">اعلان‌ها</h2><button type="button" className="text-xs text-ink-soft" onClick={() => void markAllMyNotificationsRead().then(onRefresh)}>خواندن همه</button></div>{items.length === 0 ? <div className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-soft">اعلانی ندارید.</div> : items.map((n) => <article key={n.id} className={`rounded-2xl bg-surface p-4 shadow-card ${n.readAt ? "opacity-80" : "ring-1 ring-brand/20"}`}><button type="button" className="w-full text-right" onClick={() => { void markMyNotificationRead({ data: { notificationId: n.id } }).then(onRefresh); if (n.type.startsWith("order")) onOpenOrder(); }}>{n.title}<p className="mt-1 text-sm text-ink-soft">{n.body}</p><p className="mt-2 text-[11px] text-ink-faint">{relativeTime(n.createdAt)}</p></button><button type="button" className="mt-2 text-xs text-brand" onClick={() => void deleteMyNotification({ data: { notificationId: n.id } }).then(onRefresh)}>حذف</button></article>)}</div>; }
function AccountTab({ state, onSaved, onLogout }: { state: CustomerState | null; onSaved: () => Promise<void>; onLogout: () => void }) { const [firstName, setFirstName] = useState(state?.customer?.firstName ?? ""); const [lastName, setLastName] = useState(state?.customer?.lastName ?? ""); const [phone, setPhone] = useState(state?.customer?.phone ?? ""); const [address, setAddress] = useState(state?.customer?.address ?? ""); const [busy, setBusy] = useState(false); const [localError, setLocalError] = useState(""); useEffect(() => { setFirstName(state?.customer?.firstName ?? ""); setLastName(state?.customer?.lastName ?? ""); setPhone(state?.customer?.phone ?? ""); setAddress(state?.customer?.address ?? ""); }, [state?.customer]); async function save() { setBusy(true); setLocalError(""); try { await registerCustomer({ data: { firstName: firstName.trim(), lastName: lastName.trim(), phone, address } }); await onSaved(); } catch (e) { setLocalError(e instanceof Error ? e.message : "ذخیره اطلاعات ناموفق بود."); } finally { setBusy(false); } } return <div className="space-y-3"><div className="rounded-2xl bg-surface p-4 shadow-card"><h2 className="font-bold">اطلاعات من</h2><div className="mt-4 space-y-2">{([["نام", firstName, setFirstName], ["نام خانوادگی", lastName, setLastName], ["شماره موبایل", phone, setPhone], ["آدرس", address, setAddress]] as const).map(([label, value, setter]) => <label key={label} className="block text-sm"><span className="mb-1 block">{label}</span><input className="h-11 w-full rounded-xl border border-line bg-paper px-3" value={value} onChange={(e) => setter(e.target.value)} /></label>)}</div>{localError && <p className="mt-2 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">{localError}</p>}<button type="button" disabled={busy} className="mt-3 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-fg disabled:opacity-60" onClick={() => void save()}>{busy ? "در حال ذخیره…" : "ذخیره اطلاعات"}</button></div>{state?.shop.card && <div className="rounded-2xl bg-surface p-4 shadow-card"><h2 className="font-bold">اطلاعات فروشگاه</h2><p className="mt-3 text-sm">{state.shop.name}</p><p className="mt-1 text-sm">{state.shop.card.holderName || "صاحب کارت ثبت نشده"}</p><p className="mt-1 font-mono text-base" dir="ltr">{state.shop.card.cardNumber || "شماره کارت ثبت نشده"}</p><p className="mt-1 text-xs text-ink-soft">{state.shop.card.bankName}</p></div>}<button type="button" className="w-full rounded-xl border border-line py-3 text-sm text-brand" onClick={onLogout}>خروج از حساب</button></div>; }
