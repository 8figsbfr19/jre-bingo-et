-- ─────────────────────────────────────────
-- Extend lobbies with game configuration
-- ─────────────────────────────────────────
alter table lobbies
  add column if not exists stake_amount   int not null default 0,
  add column if not exists countdown_seconds int not null default 60,
  add column if not exists countdown_started_at timestamptz,
  add column if not exists prize_pool     int not null default 0;

-- ─────────────────────────────────────────
-- lobby_cards: 400 pre-generated cards per lobby
-- ─────────────────────────────────────────
create table if not exists lobby_cards (
  id          uuid primary key default gen_random_uuid(),
  lobby_id    uuid not null references lobbies(id) on delete cascade,
  card_number int  not null check (card_number between 1 and 400),
  player_id   uuid references players(id),
  card_data   jsonb not null,
  taken_at    timestamptz,
  unique(lobby_id, card_number)
);

alter table lobby_cards enable row level security;

create policy "lobby_cards_select_all" on lobby_cards
  for select using (true);

-- Admins insert when generating the card pool
create policy "lobby_cards_insert_admin" on lobby_cards
  for insert with check (public.is_admin());

-- A player may claim an unclaimed card (set themselves as owner)
create policy "lobby_cards_claim" on lobby_cards
  for update using  (player_id is null)
  with check (player_id::text = auth.uid()::text);

-- ─────────────────────────────────────────
-- Allow bingo_claims to reference lobby_cards
-- ─────────────────────────────────────────
alter table bingo_claims
  alter column card_id drop not null;

alter table bingo_claims
  add column if not exists lobby_card_id uuid references lobby_cards(id);

-- ─────────────────────────────────────────
-- game_history: one row per completed game
-- ─────────────────────────────────────────
create table if not exists game_history (
  id              uuid primary key default gen_random_uuid(),
  lobby_id        uuid not null references lobbies(id),
  winner_id       uuid references players(id),
  winner_card_id  uuid references lobby_cards(id),
  prize_pool      int  not null default 0,
  total_players   int  not null default 0,
  balls_called    int  not null default 0,
  ended_at        timestamptz not null default now()
);

alter table game_history enable row level security;

create policy "game_history_select_all" on game_history
  for select using (true);

create policy "game_history_insert_admin" on game_history
  for insert with check (public.is_admin());

-- ─────────────────────────────────────────
-- Realtime for new tables
-- ─────────────────────────────────────────
alter publication supabase_realtime add table lobby_cards;
alter publication supabase_realtime add table game_history;
