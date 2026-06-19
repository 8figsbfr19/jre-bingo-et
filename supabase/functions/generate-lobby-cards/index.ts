import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COLUMN_RANGES: [number, number][] = [
  [1, 15], [16, 30], [31, 45], [46, 60], [61, 75],
]

function pickUnique(min: number, max: number, count: number): number[] {
  const pool: number[] = []
  for (let i = min; i <= max; i++) pool.push(i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

function generateCard(): (number | null)[][] {
  const card: (number | null)[][] = Array.from({ length: 5 }, () => Array(5).fill(null))
  for (let col = 0; col < 5; col++) {
    const [min, max] = COLUMN_RANGES[col]
    const nums = pickUnique(min, max, 5)
    for (let row = 0; row < 5; row++) card[row][col] = nums[row]
  }
  card[2][2] = null
  return card
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { lobby_id } = await req.json()
  if (!lobby_id) return new Response('Missing lobby_id', { status: 400, headers: corsHeaders })

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  // Verify caller is admin
  const { data: { user } } = await adminClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { data: player } = await adminClient.from('players').select('is_admin').eq('id', user.id).single()
  if (!player?.is_admin) return new Response('Forbidden', { status: 403, headers: corsHeaders })

  // Check if cards already generated for this lobby
  const { count } = await adminClient
    .from('lobby_cards')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', lobby_id)

  if ((count ?? 0) >= 400) {
    return new Response(JSON.stringify({ success: true, count, skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Generate and insert 400 cards in batches of 100
  const BATCH = 100
  for (let batch = 0; batch < 4; batch++) {
    const rows = Array.from({ length: BATCH }, (_, i) => ({
      lobby_id,
      card_number: batch * BATCH + i + 1,
      card_data: generateCard(),
    }))
    const { error } = await adminClient.from('lobby_cards').insert(rows)
    if (error) {
      return new Response(`Generation failed at batch ${batch}: ${error.message}`, {
        status: 500,
        headers: corsHeaders,
      })
    }
  }

  return new Response(JSON.stringify({ success: true, count: 400 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
