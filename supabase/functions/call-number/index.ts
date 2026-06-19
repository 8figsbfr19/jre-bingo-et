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

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify the caller is an admin
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { data: player } = await serviceClient.from('players').select('is_admin').eq('id', user.id).single()
  if (!player?.is_admin) return new Response('Forbidden', { status: 403, headers: corsHeaders })

  const { lobby_id } = await req.json()
  if (!lobby_id) return new Response('Missing lobby_id', { status: 400, headers: corsHeaders })

  // Check lobby is active
  const { data: lobby } = await serviceClient.from('lobbies').select('status').eq('id', lobby_id).single()
  if (lobby?.status !== 'active') {
    return new Response('Lobby is not active', { status: 400, headers: corsHeaders })
  }

  // Get already called numbers
  const { data: existing } = await serviceClient
    .from('called_numbers')
    .select('number')
    .eq('lobby_id', lobby_id)

  const calledSet = new Set((existing ?? []).map((r) => r.number))
  const remaining: number[] = []
  for (let i = 1; i <= 75; i++) {
    if (!calledSet.has(i)) remaining.push(i)
  }

  if (remaining.length === 0) {
    return new Response(JSON.stringify({ done: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const number = remaining[Math.floor(Math.random() * remaining.length)]
  const { data: called, error } = await serviceClient
    .from('called_numbers')
    .insert({ lobby_id, number })
    .select('*')
    .single()

  if (error) return new Response(error.message, { status: 500, headers: corsHeaders })

  return new Response(JSON.stringify(called), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
