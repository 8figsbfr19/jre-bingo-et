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

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user } } = await adminClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { data: caller } = await adminClient.from('players').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return new Response('Forbidden', { status: 403, headers: corsHeaders })

  const { claim_id } = await req.json()
  if (!claim_id) return new Response('Missing claim_id', { status: 400, headers: corsHeaders })

  // Load claim
  const { data: claim } = await adminClient
    .from('bingo_claims')
    .select('*')
    .eq('id', claim_id)
    .single()

  if (!claim) return new Response('Claim not found', { status: 404, headers: corsHeaders })

  if (claim.status !== 'pending') {
    return new Response(JSON.stringify({ status: claim.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Load the card — prefer lobby_card_id (new flow), fall back to card_id (legacy)
  let cardData: (number | null)[][] | null = null

  if (claim.lobby_card_id) {
    const { data: lc } = await adminClient
      .from('lobby_cards')
      .select('card_data')
      .eq('id', claim.lobby_card_id)
      .single()
    cardData = lc?.card_data ?? null
  } else if (claim.card_id) {
    const { data: bc } = await adminClient
      .from('bingo_cards')
      .select('card_numbers')
      .eq('id', claim.card_id)
      .single()
    cardData = bc?.card_numbers ?? null
  }

  if (!cardData) return new Response('Card not found', { status: 404, headers: corsHeaders })

  // Load all called numbers
  const { data: calledRows } = await adminClient
    .from('called_numbers')
    .select('number')
    .eq('lobby_id', claim.lobby_id)

  const calledSet = new Set((calledRows ?? []).map(r => r.number))
  const won = checkWin(cardData, calledSet)
  const newStatus = won ? 'verified' : 'rejected'

  // Update claim
  await adminClient.from('bingo_claims').update({ status: newStatus }).eq('id', claim_id)

  if (won) {
    // Count players and called numbers for history
    const { count: totalPlayers } = await adminClient
      .from('lobby_players')
      .select('*', { count: 'exact', head: true })
      .eq('lobby_id', claim.lobby_id)

    // Insert game_history
    await adminClient.from('game_history').insert({
      lobby_id: claim.lobby_id,
      winner_id: claim.player_id,
      winner_card_id: claim.lobby_card_id ?? null,
      prize_pool: 0,  // placeholder — real money in V2
      total_players: totalPlayers ?? 0,
      balls_called: calledRows?.length ?? 0,
    })

    // Complete the lobby
    await adminClient
      .from('lobbies')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', claim.lobby_id)
  }

  return new Response(JSON.stringify({ status: newStatus }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
