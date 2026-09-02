import { useEffect, useMemo, useState } from "react";
import { signOut } from "@/lib/auth/client";
import { getCustomerState, listCustomerOrders, registerCustomer, createCustomerOrder } from "@/lib/toranj/api/customer";
import { formatDateTime, formatToman, itemSummary, statusLabel } from "@/lib/toranj/format";

type Tab = "سفارش" | "تاریخچه" | "حساب من";
type Item = { name: string; weight: number | null; quantity: number | null; unit: string; notes: string };
type CustomerState = {
  customer: { firstName: string; lastName: string; phone: string; address: string } | null;
  shop: { name: string; publicCode: string; phone: string; isOnline: boolean; lastSeenAt: string | null; card: { holderName: string; cardNumber: string; bankName: string; extraInfo: string } };
};
type CustomerOrder = { id: string; status: string; notes: string; totalAmount: number | null; paymentStatus: string; createdAt: string; items: Array<{ name: string; weight: number | null; quantity: number | null; unit: string; notes: string }> };

export function CustomerApp() {
  const [tab, setTab] = useState<Tab>("سفارش");
  const [state, setState] = useState<CustomerState | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [items, setItems] = useState<Item[]>([{ name: "", weight: null, quantity: null, unit: "kg", notes: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setError("");
      const [next, history] = await Promise.all([getCustomerState(), listCustomerOrders()]);
      setState(next as CustomerState);
      setOrders(history as CustomerOrder[]);
    } catch (e) { setError(e instanceof Error ? e.message : "ارتباط با سرور برقرار نشد."); }
  }
  useEffect(() => { void refresh(); }, []);

  const cleanItems = useMemo(() => items.filter((x) => x.name.trim()), [items]);
  function updateItem(index: number, patch: Partial<Item>) { setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  async function sendOrder() {
    if (!cleanItems.length) { setError("حداقل یک کالا وارد کنید."); return; }
    setBusy(true); setError("");
    try {
      await createCustomerOrder({ data: { items: cleanItems, notes: "" } });
      setItems([{ name: "", weight: null, quantity: null, unit: "kg", notes: "" }]);
      setTab("تاریخچه"); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "ارسال سفارش ناموفق بود."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper pb-24">
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur"><div className="flex items-center justify-between"><div><h1 className="text-lg font-bold">مشتری ترنج</h1><p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft"><span className={`size-2 rounded-full ${state?.shop.isOnline ? "bg-green-500" : "bg-gray-400"}`} />{state?.shop.isOnline ? "فروشنده آنلاین است" : "فروشنده آفلاین است"}</p></div><button className="text-xs text-ink-soft" onClick={() => void refresh()}>به‌روزرسانی</button></div></header>
    <section className="flex-1 px-4 py-4">{error && <div className="mb-3 rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">{error}</div>}{tab === "سفارش" && <OrderTab items={items} updateItem={updateItem} addItem={() => setItems((x) => [...x, { name: "", weight: null, quantity: null, unit: "kg", notes: "" }])} removeItem={(i) => setItems((x) => x.filter((_, n) => n !== i))} send={sendOrder} busy={busy} />}{tab === "تاریخچه" && <HistoryTab orders={orders} />}{tab === "حساب من" && <AccountTab state={state} onSaved={refresh} onLogout={() => void signOut("/customer-login" as never)} />}</section>
    <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-3 border-t border-line bg-surface/95 backdrop-blur">{(["سفارش", "تاریخچه", "حساب من"] as const).map((name) => <button key={name} className={`py-3 text-sm font-medium ${tab === name ? "text-brand" : "text-ink-soft"}`} onClick={() => setTab(name)}>{name}</button>)}</nav>
  </main>;
}

function OrderTab({ items, updateItem, addItem, removeItem, send, busy }: { items: Item[]; updateItem: (i: number, p: Partial<Item>) => void; addItem: () => void; removeItem: (i: number) => void; send: () => void; busy: boolean }) {
  return <div className="space-y-3"><div className="rounded-2xl bg-surface p-4 shadow-card"><h2 className="font-semibold">لیست خرید</h2><p className="mt-1 text-xs text-ink-soft">کالاها و مقدار موردنیاز را وارد کنید.</p></div>{items.map((item, i) => <div key={i} className="rounded-2xl bg-surface p-3 shadow-card"><div className="flex gap-2"><input className="h-11 flex-1 rounded-xl border border-line bg-paper px-3" placeholder="نام کالا" value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} /><button type="button" className="text-xs text-brand" onClick={() => removeItem(i)}>حذف</button></div><div className="mt-2 grid grid-cols-3 gap-2"><input className="h-10 rounded-xl border border-line bg-paper px-2" inputMode="decimal" placeholder="وزن" value={item.weight ?? ""} onChange={(e) => updateItem(i, { weight: e.target.value ? Number(e.target.value) : null })} /><input className="h-10 rounded-xl border border-line bg-paper px-2" inputMode="numeric" placeholder="تعداد" value={item.quantity ?? ""} onChange={(e) => updateItem(i, { quantity: e.target.value ? Number(e.target.value) : null })} /><select className="h-10 rounded-xl border border-line bg-paper px-2" value={item.unit} onChange={(e) => updateItem(i, { unit: e.target.value })}><option value="kg">کیلو</option><option value="piece">عدد</option><option value="box">جعبه</option><option value="pack">بسته</option></select></div></div>)}<button type="button" className="w-full rounded-xl border border-line py-3 text-sm" onClick={addItem}>+ افزودن کالا</button><button type="button" disabled={busy} className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-fg disabled:opacity-60" onClick={() => void send()}>{busy ? "در حال ارسال…" : "ارسال سفارش به ترنج"}</button></div>;
}

function HistoryTab({ orders }: { orders: CustomerOrder[] }) {
  return <div className="space-y-3"><h2 className="text-lg font-bold">تاریخچه سفارش‌ها</h2>{orders.length === 0 ? <div className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-soft">هنوز سفارشی ثبت نشده است.</div> : orders.map((o) => <article key={o.id} className="rounded-2xl bg-surface p-4 shadow-card"><div className="flex justify-between gap-3"><div><div className="font-semibold">سفارش {o.id.slice(-6)}</div><div className="mt-1 text-xs text-ink-soft">{formatDateTime(o.createdAt)}</div></div><div className="text-left text-sm">{statusLabel(o.status)}</div></div><ul className="mt-3 space-y-1 text-sm">{o.items.map((item, i) => <li key={i}>• {itemSummary(item)}</li>)}</ul><div className="mt-3 border-t border-line pt-3 font-semibold">{formatToman(o.totalAmount)}</div></article>)}</div>;
}

function AccountTab({ state, onSaved, onLogout }: { state: CustomerState | null; onSaved: () => Promise<void>; onLogout: () => void }) {
  const [firstName, setFirstName] = useState(state?.customer?.firstName ?? ""); const [lastName, setLastName] = useState(state?.customer?.lastName ?? ""); const [phone, setPhone] = useState(state?.customer?.phone ?? ""); const [address, setAddress] = useState(state?.customer?.address ?? ""); const [busy, setBusy] = useState(false); const [localError, setLocalError] = useState("");
  useEffect(() => { setFirstName(state?.customer?.firstName ?? ""); setLastName(state?.customer?.lastName ?? ""); setPhone(state?.customer?.phone ?? ""); setAddress(state?.customer?.address ?? ""); }, [state?.customer]);
  async function save() { setBusy(true); setLocalError(""); try { await registerCustomer({ data: { firstName: firstName.trim(), lastName: lastName.trim(), phone, address } }); await onSaved(); } catch (e) { setLocalError(e instanceof Error ? e.message : "ذخیره اطلاعات ناموفق بود."); } finally { setBusy(false); } }
  return <div className="space-y-3"><div className="rounded-2xl bg-surface p-4 shadow-card"><h2 className="font-bold">اطلاعات من</h2><div className="mt-4 space-y-2">{[["نام", firstName, setFirstName], ["نام خانوادگی", lastName, setLastName], ["شماره موبایل", phone, setPhone], ["آدرس", address, setAddress]].map(([label, value, setter]) => <label key={label as string} className="block text-sm"><span className="mb-1 block">{label as string}</span><input className="h-11 w-full rounded-xl border border-line bg-paper px-3" value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} /></label>)}</div>{localError && <p className="mt-2 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">{localError}</p>}<button type="button" disabled={busy} className="mt-3 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-fg disabled:opacity-60" onClick={() => void save()}>{busy ? "در حال ذخیره…" : "ذخیره اطلاعات"}</button></div>{state?.shop.card && <div className="rounded-2xl bg-surface p-4 shadow-card"><h2 className="font-bold">اطلاعات فروشگاه</h2><p className="mt-3 text-sm">{state.shop.name}</p><p className="mt-1 text-sm">{state.shop.card.holderName || "صاحب کارت ثبت نشده"}</p><p className="mt-1 font-mono text-base" dir="ltr">{state.shop.card.cardNumber || "شماره کارت ثبت نشده"}</p><p className="mt-1 text-xs text-ink-soft">{state.shop.card.bankName}</p></div>}<button type="button" className="w-full rounded-xl border border-line py-3 text-sm text-brand" onClick={onLogout}>خروج از حساب</button></div>;
}
