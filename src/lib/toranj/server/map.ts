import type {
  AppNotification,
  CardInfo,
  Customer,
  Message,
  OrderItem,
  SellerProfile,
  Shop,
} from "../types";

export function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

export function asIsoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  return asIso(value);
}

export function asNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function asInt(value: unknown): number | null {
  const n = asNum(value);
  return n == null ? null : Math.round(n);
}

export function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === "1";
}

export function mapShop(row: Record<string, unknown>): Shop {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    publicCode: String(row.public_code),
    name: String(row.name),
    phone: String(row.phone ?? ""),
    isOnline: asBool(row.is_online),
    lastSeenAt: asIsoOrNull(row.last_seen_at),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export function mapProfile(row: Record<string, unknown>): SellerProfile {
  return {
    userId: String(row.user_id),
    shopId: String(row.shop_id),
    displayName: String(row.display_name),
    phone: String(row.phone ?? ""),
  };
}

export function mapCard(row: Record<string, unknown>): CardInfo {
  return {
    shopId: String(row.shop_id),
    holderName: String(row.holder_name ?? ""),
    cardNumber: String(row.card_number ?? ""),
    bankName: String(row.bank_name ?? ""),
    extraInfo: String(row.extra_info ?? ""),
  };
}

export function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    userId: row.user_id ? String(row.user_id) : null,
    firstName: String(row.first_name),
    lastName: String(row.last_name ?? ""),
    phone: String(row.phone),
    phoneNormalized: String(row.phone_normalized),
    address: String(row.address ?? ""),
    source: String(row.source ?? "seller"),
    isNew: asBool(row.is_new),
    notes: String(row.notes ?? ""),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export function mapItem(row: Record<string, unknown>): OrderItem {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    name: String(row.name),
    weight: asNum(row.weight),
    quantity: asNum(row.quantity),
    unit: String(row.unit ?? "kg"),
    notes: String(row.notes ?? ""),
    sortOrder: asInt(row.sort_order) ?? 0,
  };
}

export function mapMessage(row: Record<string, unknown>): Message {
  const role = String(row.sender_role);
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    customerId: row.customer_id ? String(row.customer_id) : null,
    senderRole: role === "customer" || role === "system" ? role : "seller",
    senderUserId: row.sender_user_id ? String(row.sender_user_id) : null,
    body: String(row.body),
    createdAt: asIso(row.created_at),
    deliveredAt: asIsoOrNull(row.delivered_at),
    readAt: asIsoOrNull(row.read_at),
  };
}

export function mapNotification(row: Record<string, unknown>): AppNotification {
  let payload: Record<string, string> = {};
  try {
    const raw = row.payload;
    payload =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, string>)
        : ((raw as Record<string, string>) ?? {});
  } catch {
    payload = {};
  }
  return {
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    payload,
    readAt: asIsoOrNull(row.read_at),
    createdAt: asIso(row.created_at),
  };
}

export function liveOnline(isOnline: boolean, lastSeenAt: string | null, ttlMs: number): boolean {
  if (!isOnline || !lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ttlMs;
}
