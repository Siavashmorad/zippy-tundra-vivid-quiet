import type { ReactNode } from "react";
import {
  ORDER_STATUSES,
  PAYMENT_LABEL,
  STATUS_LABEL,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/toranj/constants";
import { cn } from "@/lib/utils";

export function Btn({
  children,
  className,
  variant = "primary",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "line" | "danger";
}) {
  const styles = {
    primary: "bg-brand text-brand-fg hover:bg-brand-2",
    ghost: "bg-transparent text-ink hover:bg-paper-2",
    line: "border border-line bg-surface text-ink hover:bg-paper",
    danger: "bg-brand/10 text-brand hover:bg-brand/15",
  }[variant];
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-12 w-full rounded-xl border border-line bg-paper px-3 text-sm outline-none ring-brand/30 focus:ring-2";

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status as OrderStatus] ?? status;
  const tone =
    status === "new"
      ? "bg-brand text-brand-fg"
      : status === "ready"
        ? "bg-leaf text-leaf-fg"
        : status === "delivered"
          ? "bg-paper-2 text-ink-soft"
          : status === "cancelled"
            ? "bg-line text-ink-faint line-through"
            : status === "preparing"
              ? "bg-warn/15 text-warn"
              : "bg-ink/8 text-ink";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const label = PAYMENT_LABEL[status as PaymentStatus] ?? status;
  const tone =
    status === "paid"
      ? "bg-leaf/15 text-leaf"
      : status === "pending"
        ? "bg-warn/15 text-warn"
        : status === "rejected"
          ? "bg-brand/10 text-brand"
          : "bg-paper-2 text-ink-soft";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-medium">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-sm text-ink-soft">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="بستن"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 top-10 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface shadow-card md:inset-y-4 md:left-auto md:right-4 md:w-[28rem] md:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="h-10 px-3 text-sm text-ink-soft" onClick={onClose}>
            بستن
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export const statusOptions = ORDER_STATUSES;
