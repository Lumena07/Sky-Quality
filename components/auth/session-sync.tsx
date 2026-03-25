'use client'

import { useEffect } from 'react'
import { supabaseBrowserClient } from '@/lib/supabaseClient'
import { clearSessionCookie, setSessionCookie } from '@/lib/session-cookie'

const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // 50 minutes (token often expires at 1h)

export const SessionSync = () => {
  useEffect(() => {
    const refreshAndSync = async () => {
      const { data: { session }, error } = await supabaseBrowserClient.auth.refreshSession()
      if (error) {
        clearSessionCookie()
        return
      }
      if (session?.access_token) {
        setSessionCookie(session.access_token)
      } else {
        clearSessionCookie()
      }
    }

    const syncCurrentSession = async () => {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession()
      if (session?.access_token) {
        setSessionCookie(session.access_token)
      }
    }

    syncCurrentSession()
    refreshAndSync()

    const interval = setInterval(refreshAndSync, REFRESH_INTERVAL_MS)

    const {
      data: { subscription },
    } = supabaseBrowserClient.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setSessionCookie(session.access_token)
      } else {
        clearSessionCookie()
      }
    })

    return () => {
      clearInterval(interval)
      subscription.unsubscribe()
    }
  }, [])

  return null
}
