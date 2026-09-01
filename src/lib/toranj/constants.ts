export const SHOP_BRAND_NAME = "سوپر میوه تره‌بار ترنج";
export const SELLER_APP_NAME = "فروشنده ترنج";
export const CUSTOMER_APP_NAME = "مشتری ترنج";

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "جدید",
  confirmed: "تأیید شده",
  preparing: "در حال آماده‌سازی",
  ready: "آماده تحویل",
  delivered: "تحویل شده",
  cancelled: "لغو شده",
};

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "پرداخت نشده",
  pending: "در انتظار بررسی",
  paid: "تأیید شده",
  rejected: "رد شده",
};

export const UNITS = ["kg", "pack", "piece", "box"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABEL: Record<Unit, string> = {
  kg: "کیلو",
  pack: "بسته",
  piece: "عدد",
  box: "جعبه",
};

export const PRESENCE_TTL_MS = 45_000;
export const HEARTBEAT_MS = 15_000;
export const SELLER_EMAIL_DOMAIN = "seller.toranj.ir";
