-- Add phone fields to players (populated when user opens Mini App after sharing contact)
alter table players
  add column if not exists phone_number       text,
  add column if not exists phone_verified     boolean not null default false,
  add column if not exists contact_shared_at  timestamptz;

-- Staging table written by the bot webhook (service role only).
-- Keyed by telegram_id so it is safe even before a players row exists.
-- verify-telegram copies from here into players on first Mini App login.
create table if not exists phone_registrations (
  telegram_id   bigint primary key,
  phone_number  text not null,
  phone_verified boolean not null default true,
  registered_at  timestamptz not null default now()
);

-- Lock down to service role only (no user-facing policies)
alter table phone_registrations enable row level security;
