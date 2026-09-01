-- Toranj shop schema (seller + future customer app).
-- user_id columns are TEXT to match Better Auth / preview 'dev-user'.

create table if not exists shops (
  id text primary key,
  owner_user_id text not null unique,
  public_code text not null unique,
  name text not null,
  phone text not null default '',
  is_online boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shops_owner_idx on shops (owner_user_id);

create table if not exists seller_profiles (
  user_id text primary key,
  shop_id text not null references shops (id) on delete cascade,
  display_name text not null,
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists seller_profiles_shop_idx on seller_profiles (shop_id);

create table if not exists seller_card_information (
  shop_id text primary key references shops (id) on delete cascade,
  holder_name text not null default '',
  card_number text not null default '',
  bank_name text not null default '',
  extra_info text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id text primary key,
  shop_id text not null references shops (id) on delete cascade,
  user_id text,
  first_name text not null,
  last_name text not null default '',
  phone text not null,
  phone_normalized text not null,
  address text not null default '',
  source text not null default 'seller',
  is_new boolean not null default false,
  notes text not null default '',
  last_seen_by_seller_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_shop_phone_uidx on customers (shop_id, phone_normalized);
create index if not exists customers_shop_idx on customers (shop_id, created_at desc);
create index if not exists customers_user_idx on customers (user_id);

create table if not exists orders (
  id text primary key,
  shop_id text not null references shops (id) on delete cascade,
  customer_id text not null references customers (id) on delete restrict,
  status text not null default 'new',
  notes text not null default '',
  total_amount integer,
  payment_status text not null default 'unpaid',
  source text not null default 'customer_app',
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_shop_created_idx on orders (shop_id, created_at desc);
create index if not exists orders_customer_idx on orders (customer_id);
create index if not exists orders_shop_status_idx on orders (shop_id, status);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  name text not null,
  weight numeric,
  quantity numeric,
  unit text not null default 'kg',
  notes text not null default '',
  sort_order integer not null default 0
);
create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists messages (
  id text primary key,
  shop_id text not null references shops (id) on delete cascade,
  customer_id text references customers (id) on delete cascade,
  sender_role text not null,
  sender_user_id text,
  body text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);
create index if not exists messages_thread_idx on messages (shop_id, customer_id, created_at);

create table if not exists broadcasts (
  id text primary key,
  shop_id text not null references shops (id) on delete cascade,
  body text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists broadcasts_shop_idx on broadcasts (shop_id, created_at desc);

create table if not exists broadcast_recipients (
  broadcast_id text not null references broadcasts (id) on delete cascade,
  customer_id text not null references customers (id) on delete cascade,
  message_id text references messages (id) on delete set null,
  primary key (broadcast_id, customer_id)
);

create table if not exists payments (
  id text primary key,
  shop_id text not null references shops (id) on delete cascade,
  order_id text references orders (id) on delete set null,
  customer_id text references customers (id) on delete set null,
  amount integer,
  method text not null default 'card_to_card',
  status text not null default 'pending',
  receipt_note text not null default '',
  receipt_image_url text,
  created_at timestamptz not null default now()
);
create index if not exists payments_shop_idx on payments (shop_id, created_at desc);
create index if not exists payments_order_idx on payments (order_id);

create table if not exists notifications (
  id text primary key,
  shop_id text not null references shops (id) on delete cascade,
  user_id text not null,
  type text not null,
  title text not null,
  body text not null,
  payload text not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists push_subscriptions (
  id text primary key,
  user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

create table if not exists app_versions (
  platform text primary key,
  version text not null,
  min_version text not null,
  notes text not null default '',
  published_at timestamptz not null default now()
);

insert into app_versions (platform, version, min_version, notes)
values
  ('seller', '1.0.0', '1.0.0', 'نسخه اول اپ فروشنده ترنج'),
  ('customer', '0.0.0', '0.0.0', 'اپ مشتری هنوز منتشر نشده است')
on conflict (platform) do nothing;
