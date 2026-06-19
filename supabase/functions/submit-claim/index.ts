import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function checkWin(card: (number | null)[][], called: Set<number>): boolean {
  const hit = (r: number, c: number) => card[r][c] === null || called.has(card[r][c] as number)
  for (let r = 0; r < 5; r++) if ([0,1,2,3,4].every(c => hit(r, c))) return true
  for (let c = 0; c < 5; c++) if ([0,1,2,3,4].every(r => hit(r, c))) return true
  if ([0,1,2,3,4].every(i => hit(i, i))) return true
  if ([0,1,2,3,4].every(i => hit(i, 4 - i))) return true
  return false
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Authenticated player client
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { lobby_id, lobby_card_id } = await req.json()
  if (!lobby_id || !lobby_card_id) {
    return new Response('Missing lobby_id or lobby_card_id', { status: 400, headers: corsHeaders })
  }

  // Check player is in this lobby and not kicked
  const { data: lp } = await userClient
    .from('lobby_players')
    .select('id, status, false_claim_count')
    .eq('lobby_id', lobby_id)
    .eq('player_id', user.id)
    .single()

  if (!lp) return new Response('Not in this lobby', { status: 403, headers: corsHeaders })
  if (lp.status === 'kicked') return new Response('You have been removed from this lobby', { status: 403, headers: corsHeaders })

  // Check lobby is active
  const { data: lobby } = await userClient.from('lobbies').select('status').eq('id', lobby_id).single()
  if (lobby?.status !== 'active') return new Response('Lobby is not active', { status: 400, headers: corsHeaders })

  // Check no existing pending/verified claim from this player
  const { data: existing } = await userClient
    .from('bingo_claims')
    .select('id, status')
    .eq('lobby_id', lobby_id)
    .eq('player_id', user.id)
    .in('status', ['pending', 'verified'])
    .maybeSingle()

  if (existing) {
    return new Response(
      JSON.stringify({ error: 'Already submitted a claim', status: existing.status }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Load the player's card
  const { data: card } = await userClient
    .from('lobby_cards')
    .select('id, card_data, player_id')
    .eq('id', lobby_card_id)
    .single()

  if (!card || card.player_id !== user.id) {
    return new Response('Card not found or not yours', { status: 403, headers: corsHeaders })
  }

  // Load called numbers
  const { data: calledRows } = await userClient
    .from('called_numbers')
    .select('number')
    .eq('lobby_id', lobby_id)

  const calledSet = new Set((calledRows ?? []).map(r => r.number))
  const isValid = checkWin(card.card_data as (number | null)[][], calledSet)

  if (!isValid) {
    // False claim — kick player using security-definer RPC
    await userClient.rpc('kick_player_false_claim', {
      p_lobby_id: lobby_id,
      p_player_id: user.id,
    })

    return new Response(
      JSON.stringify({
        valid: false,
        kicked: true,
        message: 'No valid BINGO pattern found. You have been removed from this lobby.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Valid claim — create pending claim for admin verification
  const { data: claim, error: insertErr } = await userClient
    .from('bingo_claims')
    .insert({
      lobby_id,
      player_id: user.id,
      lobby_card_id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr) {
    return new Response(`Failed to create claim: ${insertErr.message}`, { status: 500, headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      valid: true,
      claim_id: claim.id,
      message: 'BINGO submitted. Waiting for admin verification.',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
