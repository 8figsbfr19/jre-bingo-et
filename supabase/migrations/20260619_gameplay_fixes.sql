-- ─────────────────────────────────────────
-- lobby_players: auto-clicker + false-claim tracking
-- ─────────────────────────────────────────
alter table lobby_players
  add column if not exists auto_clicker_enabled boolean not null default true,
  add column if not exists auto_clicker_fee     numeric(10,2) not null default 0.10,
  add column if not exists false_claim_count    int not null default 0;

-- Allow admins to update lobby_players (for false_claim_count)
create policy "lobby_players_update_admin" on lobby_players
  for update using (public.is_admin());

-- ─────────────────────────────────────────
-- game_history: one row per lobby (prevent duplicates)
-- ─────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_history_lobby_unique'
  ) then
    alter table game_history add constraint game_history_lobby_unique unique (lobby_id);
  end if;
end $$;

-- ─────────────────────────────────────────
-- lobbies: allow authenticated users to set countdown_started_at
-- (only when lobby is waiting and no countdown has been set yet)
-- ─────────────────────────────────────────
create policy "lobbies_set_countdown" on lobbies
  for update
  using  (status = 'waiting' and countdown_started_at is null)
  with check (status = 'waiting');
