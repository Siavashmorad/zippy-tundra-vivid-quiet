import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  changeOrderPayment,
  changeOrderStatus,
  createSellerOrder,
  listSellerOrders,
} from "@/lib/toranj/api/orders";
import { listSellerCustomers } from "@/lib/toranj/api/customers";
import { ORDER_STATUSES } from "@/lib/toranj/constants";
import { toFaError } from "@/lib/toranj/errors";
import {
  customerFullName,
  formatDateTime,
  formatToman,
  itemSummary,
} from "@/lib/toranj/format";
import { parseOrderLines } from "@/lib/toranj/parse-items";
import { displayPhone } from "@/lib/toranj/phone";
import type { Order } from "@/lib/toranj/types";
import { toast } from "sonner";
import { Btn, EmptyState, Field, Sheet, StatusBadge, inputClass } from "./ui";

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "new", label: "جدید" },
  { id: "active", label: "فعال" },
  { id: "delivered", label: "تحویل‌شده" },
];

export function OrdersTab({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (id?: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => listSellerOrders({ data: {} }),
  });
  const selected = orders.data?.find((o) => o.id === selectedId);

  const visible = useMemo(() => {
    const list = orders.data ?? [];
    const needle = q.trim();
    return list.filter((o) => {
      if (filter === "new" && o.status !== "new") return false;
      if (filter === "delivered" && o.status !== "delivered") return false;
      if (filter === "active" && (o.status === "delivered" || o.status === "cancelled")) return false;
      if (needle) {
        const blob = `${o.customerName} ${o.customerPhone} ${o.notes} ${o.items.map((i) => i.name).join(" ")}`;
        if (!blob.includes(needle)) return false;
      }
      return true;
    });
  }, [orders.data, filter, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 overflow-x-auto px-4 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`h-9 shrink-0 rounded-full px-3 text-sm ${filter === f.id ? "bg-brand text-brand-fg" : "bg-paper-2 text-ink-soft"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="px-4 pb-3">
        <input
          className={inputClass}
          placeholder="جستجوی سفارش، نام یا شماره"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24">
        {orders.isError ? (
          <EmptyState title="خطا در دریافت سفارش‌ها" hint={toFaError(orders.error)} />
        ) : orders.isLoading ? (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-paper-2" />
            <div className="h-28 animate-pulse rounded-2xl bg-paper-2" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="سفارشی نیست"
            hint="سفارش‌های اپ مشتری همین‌جا ظاهر می‌شوند. می‌توانید سفارش حضوری هم ثبت کنید."
            action={
              <Btn onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                سفارش حضوری
              </Btn>
            }
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onSelect(order.id)}
                  className="w-full rounded-2xl bg-surface p-4 text-right shadow-card transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{order.customerName}</p>
                      <p className="mt-0.5 text-sm text-ink-soft dir-ltr" dir="ltr">
                        {displayPhone(order.customerPhone)}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-ink-soft">
                    {order.items.map(itemSummary).join(" · ") || "بدون قلم"}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
                    <span>{formatDateTime(order.createdAt)}</span>
                    <span className="tabular-nums">{formatToman(order.totalAmount)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="fixed bottom-5 left-1/2 z-20 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-fg shadow-card md:left-auto md:right-8 md:translate-x-0"
      >
        <Plus className="size-4" />
        سفارش حضوری
      </button>
      <OrderSheet
        order={selected}
        onClose={() => onSelect(undefined)}
        onChanged={() => void qc.invalidateQueries({ queryKey: ["orders"] })}
      />
      <WalkInSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          void qc.invalidateQueries({ queryKey: ["orders"] });
          onSelect(id);
        }}
      />
    </div>
  );
}

function OrderSheet({
  order,
  onClose,
  onChanged,
}: {
  order?: Order;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [amount, setAmount] = useState("");
  const statusMut = useMutation({
    mutationFn: (status: string) => changeOrderStatus({ data: { id: order!.id, status } }),
    onSuccess: () => {
      toast.success("وضعیت سفارش به‌روز شد.");
      onChanged();
    },
    onError: (e) => toast.error(toFaError(e)),
  });
  const payMut = useMutation({
    mutationFn: () =>
      changeOrderPayment({
        data: {
          id: order!.id,
          paymentStatus: "paid",
          totalAmount: amount ? Number(amount) : order!.totalAmount,
        },
      }),
    onSuccess: () => {
      toast.success("پرداخت ثبت شد.");
      onChanged();
    },
    onError: (e) => toast.error(toFaError(e)),
  });
  return (
    <Sheet open={Boolean(order)} onClose={onClose} title="جزئیات سفارش">
      {order ? (
        <div className="space-y-4">
          <div>
            <p className="text-lg font-semibold">{order.customerName}</p>
            <p className="text-sm text-ink-soft" dir="ltr">
              {displayPhone(order.customerPhone)}
            </p>
            <p className="mt-1 text-xs text-ink-faint">{formatDateTime(order.createdAt)}</p>
          </div>
          <ul className="divide-y divide-line rounded-2xl bg-paper">
            {order.items.map((item) => (
              <li key={item.id} className="px-3 py-3">
                <p className="font-medium">{itemSummary(item)}</p>
                {item.notes ? <p className="text-sm text-ink-soft">{item.notes}</p> : null}
              </li>
            ))}
          </ul>
          {order.notes ? (
            <p className="rounded-xl bg-paper-2 px-3 py-2 text-sm">توضیحات: {order.notes}</p>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium">تغییر وضعیت</p>
            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={statusMut.isPending}
                  onClick={() => statusMut.mutate(s)}
                  className={`rounded-full px-3 py-2 text-xs ${order.status === s ? "bg-brand text-brand-fg" : "bg-paper-2 text-ink-soft"}`}
                >
                  <StatusBadge status={s} />
                </button>
              ))}
            </div>
          </div>
          <Field label="مبلغ (تومان)">
            <input
              className={inputClass}
              inputMode="numeric"
              dir="ltr"
              defaultValue={order.totalAmount ?? ""}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="اختیاری"
            />
          </Field>
          <Btn onClick={() => payMut.mutate()} disabled={payMut.isPending} className="w-full">
            ثبت پرداخت‌شده
          </Btn>
        </div>
      ) : null}
    </Sheet>
  );
}

function WalkInSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => listSellerCustomers({ data: {} }),
    enabled: open,
  });
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState("گوجه — ۲ کیلو\nسیب — ۳ کیلو");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      createSellerOrder({
        data: {
          customerId,
          items: parseOrderLines(lines),
          notes,
          totalAmount: amount ? Number(amount) : null,
        },
      }),
    onSuccess: (order) => {
      toast.success("سفارش حضوری ثبت شد.");
      onCreated(order.id);
    },
    onError: (e) => toast.error(toFaError(e)),
  });
  return (
    <Sheet open={open} onClose={onClose} title="سفارش حضوری">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customerId) {
            toast.error("مشتری را انتخاب کنید.");
            return;
          }
          mut.mutate();
        }}
      >
        <Field label="مشتری">
          <select
            className={inputClass}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">انتخاب کنید</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {customerFullName(c.firstName, c.lastName)} — {displayPhone(c.phone)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="اقلام (هر خط یک کالا)">
          <textarea
            className={`${inputClass} h-32 py-3`}
            value={lines}
            onChange={(e) => setLines(e.target.value)}
          />
        </Field>
        <Field label="توضیحات">
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="مبلغ (تومان)">
          <input
            className={inputClass}
            dir="ltr"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Btn type="submit" className="w-full" disabled={mut.isPending}>
          ثبت سفارش
        </Btn>
      </form>
    </Sheet>
  );
}
