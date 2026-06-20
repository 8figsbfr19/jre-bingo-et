import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN    = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const MINI_APP_URL = Deno.env.get('MINI_APP_URL') ?? 'https://your-app.vercel.app'
const TG_API      = `https://api.telegram.org/bot${BOT_TOKEN}`

// ── Telegram API helpers ─────────────────────────────────────────────────────

async function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  })
}

function playButton() {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎮 Play JRE Bingo ET', web_app: { url: MINI_APP_URL } },
      ]],
    },
  }
}

function contactKeyboard() {
  return {
    reply_markup: {
      keyboard: [[{ text: '📱 Share Contact', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  // Telegram only uses POST
  if (req.method !== 'POST') {
    return new Response('JRE Bingo ET webhook is running.', { status: 200 })
  }

  // Validate secret token (set via setWebhook secret_token parameter)
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
    if (incoming !== WEBHOOK_SECRET) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  let update: Record<string, unknown>
  try {
    update = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const message = update.message as Record<string, unknown> | undefined
  if (!message) return new Response('ok') // edited_message, channel_post, etc.

  const chatId  = (message.chat as Record<string, unknown>).id as number
  const from    = message.from as Record<string, unknown>
  const text    = message.text as string | undefined
  const contact = message.contact as Record<string, unknown> | undefined

  // ── /start ────────────────────────────────────────────────────────────────
  if (text === '/start') {
    await sendMessage(
      chatId,
      `👋 Welcome to JRE Bingo ET, ${from.first_name ?? 'Player'}!\n\nTo start playing, please share your phone number.`,
      contactKeyboard(),
    )
    return new Response('ok')
  }

  // ── Contact shared ────────────────────────────────────────────────────────
  if (contact) {
    const contactUserId = contact.user_id as number | undefined

    // Security: the shared contact must belong to the sender
    if (contactUserId && contactUserId !== (from.id as number)) {
      await sendMessage(chatId, 'Please share your own phone number, not someone else\'s.')
      return new Response('ok')
    }

    const phone = contact.phone_number as string

    // Save to phone_registrations staging table (service role, bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: upsertErr } = await serviceClient
      .from('phone_registrations')
      .upsert(
        {
          telegram_id:   from.id as number,
          phone_number:  phone,
          phone_verified: true,
          registered_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_id' },
      )

    if (upsertErr) {
      console.error('phone_registrations upsert error:', upsertErr.message)
    }

    // Also update players row directly if it already exists (returning user)
    await serviceClient
      .from('players')
      .update({
        phone_number:       phone,
        phone_verified:     true,
        contact_shared_at:  new Date().toISOString(),
      })
      .eq('telegram_id', from.id as number)

    // Confirmation + Play button (one_time_keyboard auto-hides after contact tap)
    await sendMessage(
      chatId,
      '🎉 Registration Complete!\n\nYou can now play JRE Bingo ET directly inside Telegram.',
      playButton(),
    )

    return new Response('ok')
  }

  // ── Any other message ─────────────────────────────────────────────────────
  await sendMessage(
    chatId,
    `Send /start to register, or tap the button below to open the game.`,
    playButton(),
  )

  return new Response('ok')
})
