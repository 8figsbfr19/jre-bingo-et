import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function checkWin(card: (number | null)[][], called: Set<number>): boolean {
  const hit = (r: number, c: number) => card[r][c] === null || called.has(card[r][c] as number)
  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every((c) => hit(r, c))) return true
  }
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every((r) => hit(r, c))) return true
  }
  if ([0, 1, 2, 3, 4].every((i) => hit(i, i))) return true
  if ([0, 1, 2, 3, 4].every((i) => hit(i, 4 - i))) return true
  return false
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { claim_id } = await req.json()
  if (!claim_id) return new Response('Missing claim_id', { status: 400, headers: corsHeaders })

  // Load the claim
  const { data: claim } = await serviceClient
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

  // Verify caller is admin
  const { data: caller } = await serviceClient.from('players').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return new Response('Forbidden', { status: 403, headers: corsHeaders })

  // Load the bingo card
  const { data: card } = await serviceClient
    .from('bingo_cards')
    .select('card_numbers')
    .eq('id', claim.card_id)
    .single()

  if (!card) return new Response('Card not found', { status: 404, headers: corsHeaders })

  // Load all called numbers for the lobby
  const { data: calledRows } = await serviceClient
    .from('called_numbers')
    .select('number')
    .eq('lobby_id', claim.lobby_id)

  const calledSet = new Set((calledRows ?? []).map((r) => r.number))
  const won = checkWin(card.card_numbers as (number | null)[][], calledSet)
  const newStatus = won ? 'verified' : 'rejected'

  await serviceClient
    .from('bingo_claims')
    .update({ status: newStatus })
    .eq('id', claim_id)

  return new Response(JSON.stringify({ status: newStatus }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
