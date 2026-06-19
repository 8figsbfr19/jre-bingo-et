-- Enable UUID extension
create extension if not exists "pgcrypto";

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

-- Players can read their own row; admins can read all
create policy "players_select_own" on players
  for select using (
    auth.uid()::text = id::text
    or exists (
      select 1 from players p2
      where p2.id::text = auth.uid()::text and p2.is_admin = true
    )
  );

-- Only Edge Functions (service role) may insert/update
create policy "players_insert_service" on players
  for insert with check (auth.role() = 'service_role');

create policy "players_update_service" on players
  for update using (auth.role() = 'service_role');

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
  for all using (
    exists (
      select 1 from players p
      where p.id::text = auth.uid()::text and p.is_admin = true
    )
  );

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
    or exists (
      select 1 from players p
      where p.id::text = auth.uid()::text and p.is_admin = true
    )
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
    or exists (
      select 1 from players p
      where p.id::text = auth.uid()::text and p.is_admin = true
    )
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
