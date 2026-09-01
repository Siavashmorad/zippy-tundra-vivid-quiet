import type { OrderStatus, PaymentStatus, Unit } from "./constants";

export type Shop = {
  id: string;
  ownerUserId: string;
  publicCode: string;
  name: string;
  phone: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SellerProfile = {
  userId: string;
  shopId: string;
  displayName: string;
  phone: string;
};

export type CardInfo = {
  shopId: string;
  holderName: string;
  cardNumber: string;
  bankName: string;
  extraInfo: string;
};

export type Customer = {
  id: string;
  shopId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  phoneNormalized: string;
  address: string;
  source: string;
  isNew: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  name: string;
  weight: number | null;
  quantity: number | null;
  unit: Unit | string;
  notes: string;
  sortOrder: number;
};

export type Order = {
  id: string;
  shopId: string;
  customerId: string;
  status: OrderStatus | string;
  notes: string;
  totalAmount: number | null;
  paymentStatus: PaymentStatus | string;
  source: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
};

export type Message = {
  id: string;
  shopId: string;
  customerId: string | null;
  senderRole: "seller" | "customer" | "system";
  senderUserId: string | null;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
};

export type Thread = {
  customer: Customer;
  lastMessage: Message | null;
  unreadCount: number;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
};

export type ShopEvent = {
  id: number;
  shopId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type SellerBootstrap = {
  shop: Shop;
  profile: SellerProfile;
  card: CardInfo;
  newOrderCount: number;
  unreadMessageCount: number;
  newCustomerCount: number;
  unreadNotificationCount: number;
  appVersion: string;
  latestVersion: string;
  updateNotes: string;
};
