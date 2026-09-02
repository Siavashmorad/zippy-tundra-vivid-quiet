-- Native device tokens (Capacitor Push / FCM) alongside existing web-push subscriptions.

create table if not exists device_tokens (
  id text primary key,
  user_id text not null,
  token text not null,
  platform text not null default 'android',
  app_role text not null default 'seller',
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists device_tokens_token_uidx on device_tokens (token);
create index if not exists device_tokens_user_idx on device_tokens (user_id) where active = true;
