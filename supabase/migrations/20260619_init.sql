-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- Helper: admin check (security definer bypasses RLS to avoid recursion)
-- ─────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.players where id = auth.uid()),
    false
  )
$$;

-- ─────────────────────────────────────────
-- players
-- ─────────────────────────────────────────
create table players (
  id           uuid primary key default gen_random_uuid(),
  telegram_id  bigint unique not null,
  telegram_username text,
  first_name   text,
  last_name    text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table players enable row level security;

create policy "players_select_own" on players
  for select using (
    auth.uid()::text = id::text
    or public.is_admin()
  );

-- Players insert/update their own row (id must match their auth.uid())
create policy "players_insert_self" on players
  for insert with check (id::text = auth.uid()::text);

create policy "players_update_self" on players
  for update using (id::text = auth.uid()::text);

-- ─────────────────────────────────────────
-- lobbies
-- ─────────────────────────────────────────
create type lobby_status as enum ('waiting', 'active', 'paused', 'completed');

create table lobbies (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  max_players int not null default 100,
  status      lobby_status not null default 'waiting',
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  ended_at    timestamptz
);

alter table lobbies enable row level security;

create policy "lobbies_select_all" on lobbies
  for select using (true);

create policy "lobbies_write_admin" on lobbies
  for all using (public.is_admin());

-- ─────────────────────────────────────────
-- lobby_players
-- ─────────────────────────────────────────
create table lobby_players (
  id        uuid primary key default gen_random_uuid(),
  lobby_id  uuid not null references lobbies(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(lobby_id, player_id)
);

alter table lobby_players enable row level security;

create policy "lobby_players_select_all" on lobby_players
  for select using (true);

create policy "lobby_players_insert_self" on lobby_players
  for insert with check (player_id::text = auth.uid()::text);

create policy "lobby_players_delete_self" on lobby_players
  for delete using (player_id::text = auth.uid()::text);

-- ─────────────────────────────────────────
-- bingo_cards
-- ─────────────────────────────────────────
create table bingo_cards (
  id           uuid primary key default gen_random_uuid(),
  lobby_id     uuid not null references lobbies(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  card_numbers jsonb not null,  -- [[n,n,n,n,n], ...] 5x5, null = free space
  unique(lobby_id, player_id)
);

alter table bingo_cards enable row level security;

create policy "bingo_cards_select_own" on bingo_cards
  for select using (
    player_id::text = auth.uid()::text
    or public.is_admin()
  );

create policy "bingo_cards_insert_service" on bingo_cards
  for insert with check (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- called_numbers
-- ─────────────────────────────────────────
create table called_numbers (
  id        uuid primary key default gen_random_uuid(),
  lobby_id  uuid not null references lobbies(id) on delete cascade,
  number    int not null check (number between 1 and 75),
  called_at timestamptz not null default now(),
  unique(lobby_id, number)
);

alter table called_numbers enable row level security;

create policy "called_numbers_select_all" on called_numbers
  for select using (true);

create policy "called_numbers_insert_service" on called_numbers
  for insert with check (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- bingo_claims
-- ─────────────────────────────────────────
create type claim_status as enum ('pending', 'verified', 'rejected');

create table bingo_claims (
  id        uuid primary key default gen_random_uuid(),
  lobby_id  uuid not null references lobbies(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  card_id   uuid not null references bingo_cards(id) on delete cascade,
  status    claim_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table bingo_claims enable row level security;

create policy "bingo_claims_select_participant" on bingo_claims
  for select using (
    player_id::text = auth.uid()::text
    or public.is_admin()
  );

create policy "bingo_claims_insert_self" on bingo_claims
  for insert with check (player_id::text = auth.uid()::text);

create policy "bingo_claims_update_service" on bingo_claims
  for update using (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- Realtime: enable publications
-- ─────────────────────────────────────────
alter publication supabase_realtime add table lobbies;
alter publication supabase_realtime add table called_numbers;
alter publication supabase_realtime add table bingo_claims;
alter publication supabase_realtime add table lobby_players;
