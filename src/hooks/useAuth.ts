import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Player } from '../lib/database.types'
import { useTelegram } from './useTelegram'

interface AuthState {
  player: Player | null
  loading: boolean
  error: string | null
  inTelegram: boolean
  retry: () => void
}

export function useAuth(): AuthState {
  const { initData, isReady } = useTelegram()
  const [state, setState] = useState<AuthState & { _tick: number }>({
    player: null,
    loading: true,
    error: null,
    inTelegram: isReady,
    retry: () => {},
    _tick: 0,
  })

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null, _tick: s._tick + 1 }))
  }, [])

  useEffect(() => {
    setState((s) => ({ ...s, retry }))
  }, [retry])

  useEffect(() => {
    let cancelled = false

    async function authenticate() {
      // Resume an existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data } = await supabase.from('players').select('*').eq('id', session.user.id).single()
        if (!cancelled) setState((s) => ({ ...s, player: data ?? null, loading: false, error: null, inTelegram: true }))
        return
      }

      // Not inside Telegram at all
      if (!isReady) {
        if (!cancelled) setState((s) => ({ ...s, player: null, loading: false, error: null, inTelegram: false }))
        return
      }

      // Inside Telegram but initData is empty (Telegram Desktop edge case)
      if (!initData) {
        if (!cancelled) setState((s) => ({ ...s, player: null, loading: false, error: 'Telegram data unavailable. Try reopening the app.', inTelegram: true }))
        return
      }

      try {
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-telegram`
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        })

        if (!res.ok) {
          const text = await res.text()
          if (!cancelled) setState((s) => ({ ...s, player: null, loading: false, error: `Auth error: ${text}`, inTelegram: true }))
          return
        }

        const { access_token, refresh_token, player } = await res.json()
        await supabase.auth.setSession({ access_token, refresh_token })
        if (!cancelled) setState((s) => ({ ...s, player, loading: false, error: null, inTelegram: true }))
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, player: null, loading: false, error: String(err), inTelegram: true }))
      }
    }

    authenticate()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData, isReady, state._tick])

  return state
}
