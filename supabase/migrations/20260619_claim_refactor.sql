-- lobby_players: track kicked state
alter table lobby_players
  add column if not exists status    text    not null default 'joined' check (status in ('joined', 'kicked')),
  add column if not exists is_locked boolean not null default false;

-- Security-definer RPC so the submit-claim Edge Function can kick a player
-- even without service-role BYPASSRLS. Called with the player's own JWT.
create or replace function public.kick_player_false_claim(
  p_lobby_id uuid,
  p_player_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update lobby_players
  set
    status            = 'kicked',
    is_locked         = true,
    false_claim_count = false_claim_count + 1
  where lobby_id = p_lobby_id
    and player_id = p_player_id;
$$;

-- Grant execute to authenticated role
grant execute on function public.kick_player_false_claim(uuid, uuid) to authenticated;
