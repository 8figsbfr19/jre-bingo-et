-- Fix: infinite recursion in RLS policies
-- The original policies used "exists (select 1 from players ...)" inside a
-- players policy, causing PostgreSQL to recurse indefinitely.
-- Solution: a security definer function reads players as the postgres superuser
-- (which bypasses RLS), so no cycle can form.

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

-- Players: replace recursive subquery with the security-definer function
drop policy if exists "players_select_own" on players;
create policy "players_select_own" on players
  for select using (
    auth.uid()::text = id::text
    or public.is_admin()
  );

-- Lobbies: same fix
drop policy if exists "lobbies_write_admin" on lobbies;
create policy "lobbies_write_admin" on lobbies
  for all using (public.is_admin());

-- Bingo cards: same fix
drop policy if exists "bingo_cards_select_own" on bingo_cards;
create policy "bingo_cards_select_own" on bingo_cards
  for select using (
    player_id::text = auth.uid()::text
    or public.is_admin()
  );

-- Bingo claims: same fix
drop policy if exists "bingo_claims_select_participant" on bingo_claims;
create policy "bingo_claims_select_participant" on bingo_claims
  for select using (
    player_id::text = auth.uid()::text
    or public.is_admin()
  );
