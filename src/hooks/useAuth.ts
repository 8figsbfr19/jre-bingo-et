import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Player } from '../lib/database.types'
import { useTelegram } from './useTelegram'

interface AuthState {
  player: Player | null
  loading: boolean
  error: string | null
}

export function useAuth(): AuthState {
  const { initData } = useTelegram()
  const [state, setState] = useState<AuthState>({ player: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    async function authenticate() {
      // Already have a session
      const { data: { session } } = await supabase.auth.getSession()
      if (session && !cancelled) {
        const { data } = await supabase.from('players').select('*').eq('id', session.user.id).single()
        if (!cancelled) setState({ player: data ?? null, loading: false, error: null })
        return
      }

      if (!initData) {
        // Dev mode: no Telegram context
        if (!cancelled) setState({ player: null, loading: false, error: null })
        return
      }

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-telegram`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })

      if (!res.ok) {
        if (!cancelled) setState({ player: null, loading: false, error: 'Auth failed' })
        return
      }

      const { access_token, refresh_token, player } = await res.json()
      await supabase.auth.setSession({ access_token, refresh_token })
      if (!cancelled) setState({ player, loading: false, error: null })
    }

    authenticate()
    return () => { cancelled = true }
  }, [initData])

  return state
}
