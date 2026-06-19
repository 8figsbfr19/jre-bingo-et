-- Replace service-role-gated insert/update with self-based policies.
-- Players insert/update their own row using their auth session (id = auth.uid()).
-- Service role still works because BYPASSRLS is set on service_role in Supabase.

drop policy if exists "players_insert_service" on players;
drop policy if exists "players_update_service" on players;

create policy "players_insert_self" on players
  for insert with check (id::text = auth.uid()::text);

create policy "players_update_self" on players
  for update using (id::text = auth.uid()::text);
