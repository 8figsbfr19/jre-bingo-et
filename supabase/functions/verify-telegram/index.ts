import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { initData } = await req.json()
  if (!initData) return new Response('Missing initData', { status: 400, headers: corsHeaders })

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!

  // Validate HMAC-SHA256
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  params.delete('hash')

  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKeyRaw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const secretKey = await crypto.subtle.sign('HMAC', secretKeyRaw, new TextEncoder().encode(botToken))

  const signingKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(checkString))
  const computedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (computedHash !== hash) {
    return new Response('Invalid initData', { status: 401, headers: corsHeaders })
  }

  // Parse user from initData
  const userRaw = params.get('user')
  if (!userRaw) return new Response('No user in initData', { status: 400, headers: corsHeaders })
  const tgUser = JSON.parse(userRaw)

  // Upsert player using service role client
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: player, error } = await serviceClient
    .from('players')
    .upsert(
      {
        telegram_id: tgUser.id,
        telegram_username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        last_name: tgUser.last_name ?? null,
      },
      { onConflict: 'telegram_id' },
    )
    .select('*')
    .single()

  if (error) return new Response(error.message, { status: 500, headers: corsHeaders })

  // Sign a Supabase JWT for this player
  const { data: authData, error: authError } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: `${tgUser.id}@telegram.user`,
  })

  if (authError) return new Response(authError.message, { status: 500, headers: corsHeaders })

  // Create a real session via sign-in with OTP verification (token_hash approach)
  // Instead, we sign the user in using admin API
  const { data: sessionData, error: sessionError } = await serviceClient.auth.admin.createUser({
    email: `${tgUser.id}@telegram.user`,
    email_confirm: true,
    user_metadata: { player_id: player.id },
    app_metadata: { player_id: player.id },
  })

  // User may already exist — that's fine
  const userId = sessionData?.user?.id ?? (await (async () => {
    const { data } = await serviceClient.auth.admin.listUsers()
    return data.users.find((u) => u.email === `${tgUser.id}@telegram.user`)?.id
  })())

  if (!userId) return new Response('Could not resolve auth user', { status: 500, headers: corsHeaders })

  // Update player id to match auth user id if needed (first time)
  await serviceClient.from('players').update({ id: userId }).eq('telegram_id', tgUser.id).neq('id', userId)

  const { data: tokens, error: tokenError } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: `${tgUser.id}@telegram.user`,
  })

  if (tokenError) return new Response(tokenError.message, { status: 500, headers: corsHeaders })

  // Exchange magic link token for session tokens
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )

  const token = new URL(tokens.properties!.action_link).searchParams.get('token')!
  const { data: session, error: verifyError } = await anonClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: token,
  })

  if (verifyError || !session.session) {
    return new Response(verifyError?.message ?? 'No session', { status: 500, headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
      player,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )

  void authData
  void sessionError
})
