import { STATUS_LABEL, UNIT_LABEL, type OrderStatus, type Unit } from "./constants";

const faDate = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const faTime = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
});

const faNum = new Intl.NumberFormat("fa-IR");

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return faDate.format(d);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return faTime.format(d);
}

export function formatFaNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return faNum.format(n);
}

export function formatToman(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return `${faNum.format(n)} تومان`;
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as OrderStatus] ?? status;
}

export function unitLabel(unit: string): string {
  return UNIT_LABEL[unit as Unit] ?? unit;
}

export function customerFullName(first: string, last = ""): string {
  return `${first} ${last}`.trim() || "مشتری";
}

export function itemSummary(item: {
  name: string;
  weight?: number | null;
  quantity?: number | null;
  unit?: string | null;
}): string {
  const bits: string[] = [item.name];
  if (item.weight != null && item.weight !== 0) {
    bits.push(`${formatFaNumber(item.weight)} ${unitLabel(item.unit ?? "kg")}`);
  } else if (item.quantity != null && item.quantity !== 0) {
    bits.push(`${formatFaNumber(item.quantity)} ${unitLabel(item.unit ?? "piece")}`);
  }
  return bits.join(" — ");
}

export function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(d.getTime())) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "همین الان";
  if (m < 60) return `${formatFaNumber(m)} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${formatFaNumber(h)} ساعت پیش`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${formatFaNumber(days)} روز پیش`;
  return formatDateTime(iso);
}

export function phoneToSellerEmail(phone: string): string {
  return `${phone}@seller.toranj.ir`;
}

export function isSellerEmail(email: string): boolean {
  return email.endsWith("@seller.toranj.ir");
}
