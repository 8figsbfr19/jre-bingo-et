import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  // Verify caller is admin
  const { data: { user } } = await adminClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  const { data: caller } = await adminClient.from('players').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return new Response('Forbidden', { status: 403, headers: corsHeaders })

  const { claim_id, action } = await req.json() as { claim_id: string; action: 'approve' | 'reject' }
  if (!claim_id) return new Response('Missing claim_id', { status: 400, headers: corsHeaders })
  if (action !== 'approve' && action !== 'reject') return new Response('action must be approve or reject', { status: 400, headers: corsHeaders })

  // Load claim — must be pending
  const { data: claim } = await adminClient
    .from('bingo_claims').select('*').eq('id', claim_id).single()
  if (!claim) return new Response('Claim not found', { status: 404, headers: corsHeaders })

  if (claim.status !== 'pending') {
    return new Response(
      JSON.stringify({ status: claim.status, already_processed: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Load lobby — must not already be completed
  const { data: lobby } = await adminClient
    .from('lobbies').select('status, stake_amount').eq('id', claim.lobby_id).single()

  if (lobby?.status === 'completed') {
    return new Response(
      JSON.stringify({ status: 'lobby_already_completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // ────────────────────────────────────
  // REJECT: kick player, lobby continues
  // ────────────────────────────────────
  if (action === 'reject') {
    await adminClient.from('bingo_claims').update({ status: 'rejected' }).eq('id', claim_id)

    // Kick the player from this lobby
    await adminClient.rpc('kick_player_false_claim', {
      p_lobby_id: claim.lobby_id,
      p_player_id: claim.player_id,
    })

    return new Response(
      JSON.stringify({ status: 'rejected' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // ────────────────────────────────────
  // APPROVE: complete lobby, record history
  // ────────────────────────────────────
  await adminClient.from('bingo_claims').update({ status: 'verified' }).eq('id', claim_id)

  // Count confirmed players for prize pool
  const { count: totalPlayers } = await adminClient
    .from('lobby_players')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', claim.lobby_id)
    .neq('status', 'kicked')

  const { count: calledCount } = await adminClient
    .from('called_numbers')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', claim.lobby_id)

  const prizePool = (totalPlayers ?? 0) * (lobby?.stake_amount ?? 0)

  // Insert game_history (unique constraint prevents duplicates)
  await adminClient.from('game_history').upsert(
    {
      lobby_id: claim.lobby_id,
      winner_id: claim.player_id,
      winner_card_id: claim.lobby_card_id ?? null,
      prize_pool: prizePool,
      total_players: totalPlayers ?? 0,
      balls_called: calledCount ?? 0,
    },
    { onConflict: 'lobby_id', ignoreDuplicates: true },
  )

  // Complete the lobby
  await adminClient.from('lobbies').update({
    status: 'completed',
    ended_at: new Date().toISOString(),
    prize_pool: prizePool,
  }).eq('id', claim.lobby_id)

  return new Response(
    JSON.stringify({ status: 'approved', prize_pool: prizePool }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
