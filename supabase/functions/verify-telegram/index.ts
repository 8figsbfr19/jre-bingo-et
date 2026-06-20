import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyHmac(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return false
  params.delete('hash')

  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // secret = HMAC-SHA256("WebAppData", botToken)
  const webAppDataKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const secretBytes = await crypto.subtle.sign('HMAC', webAppDataKey, new TextEncoder().encode(botToken))

  const signingKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(checkString))
  const computed = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === hash
}

async function derivePassword(botToken: string, telegramId: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(botToken),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(telegramId)))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: { initData?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders })
  }

  const { initData } = body
  if (!initData) return new Response('Missing initData', { status: 400, headers: corsHeaders })

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!botToken) return new Response('Bot token not configured', { status: 500, headers: corsHeaders })

  // Verify Telegram HMAC signature
  const valid = await verifyHmac(initData, botToken)
  if (!valid) return new Response('Invalid initData signature', { status: 401, headers: corsHeaders })

  // Parse Telegram user
  const params = new URLSearchParams(initData)
  const userRaw = params.get('user')
  if (!userRaw) return new Response('No user in initData', { status: 400, headers: corsHeaders })

  let tgUser: { id: number; username?: string; first_name?: string; last_name?: string }
  try {
    tgUser = JSON.parse(userRaw)
  } catch {
    return new Response('Invalid user JSON', { status: 400, headers: corsHeaders })
  }

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const email = `tg_${tgUser.id}@bingo.local`
  const password = await derivePassword(botToken, tgUser.id)

  // Try to sign in (returning user path — fast and simple)
  const { data: signInData } = await serviceClient.auth.signInWithPassword({ email, password })

  let session = signInData?.session
  let userId = signInData?.user?.id

  if (!session) {
    // New user — create auth account, then sign in
    const { data: createData, error: createErr } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createErr && !createErr.message.toLowerCase().includes('already registered')) {
      return new Response(`Create user failed: ${createErr.message}`, { status: 500, headers: corsHeaders })
    }

    userId = createData?.user?.id

    const { data: signIn2, error: signIn2Err } = await serviceClient.auth.signInWithPassword({ email, password })
    if (signIn2Err || !signIn2?.session) {
      return new Response(`Sign in failed: ${signIn2Err?.message ?? 'no session'}`, { status: 500, headers: corsHeaders })
    }
    session = signIn2.session
    userId = signIn2.user?.id
  }

  if (!session || !userId) {
    return new Response('Could not create session', { status: 500, headers: corsHeaders })
  }

  // Use the user's own session for player row writes.
  // This satisfies "id = auth.uid()" self-based RLS policies without
  // depending on service_role BYPASSRLS resolution.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${session.access_token}` } } },
  )

  const { data: existing } = await userClient
    .from('players')
    .select('*')
    .eq('id', userId)
    .single()

  let player
  if (existing) {
    const { data: updated } = await userClient
      .from('players')
      .update({
        telegram_username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        last_name: tgUser.last_name ?? null,
      })
      .eq('id', userId)
      .select('*')
      .single()
    player = updated
  } else {
    const { data: inserted, error: insertErr } = await userClient
      .from('players')
      .insert({
        id: userId,
        telegram_id: tgUser.id,
        telegram_username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        last_name: tgUser.last_name ?? null,
      })
      .select('*')
      .single()
    if (insertErr) return new Response(`Player insert failed: ${insertErr.message}`, { status: 500, headers: corsHeaders })
    player = inserted
  }

  // Merge phone registration if the user shared contact via bot before opening Mini App
  if (!player?.phone_number) {
    const { data: phoneReg } = await serviceClient
      .from('phone_registrations')
      .select('phone_number, phone_verified, registered_at')
      .eq('telegram_id', tgUser.id)
      .single()

    if (phoneReg?.phone_number) {
      const { data: withPhone } = await serviceClient
        .from('players')
        .update({
          phone_number:      phoneReg.phone_number,
          phone_verified:    phoneReg.phone_verified,
          contact_shared_at: phoneReg.registered_at,
        })
        .eq('id', userId)
        .select('*')
        .single()
      if (withPhone) player = withPhone
    }
  }

  return new Response(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      player,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
