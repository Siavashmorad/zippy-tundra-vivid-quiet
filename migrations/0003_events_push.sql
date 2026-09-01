-- Realtime event log + VAPID secrets for web push.

create table if not exists shop_events (
  id bigserial primary key,
  shop_id text not null references shops (id) on delete cascade,
  type text not null,
  payload text not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists shop_events_shop_id_idx on shop_events (shop_id, id);

create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists order_status_events (
  id text primary key,
  order_id text not null references orders (id) on delete cascade,
  shop_id text not null references shops (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id text,
  created_at timestamptz not null default now()
);
create index if not exists order_status_events_order_idx on order_status_events (order_id, created_at);
