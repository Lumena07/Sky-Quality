'use client'

import { useEffect } from 'react'
import { supabaseBrowserClient } from '@/lib/supabaseClient'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // 50 minutes (token often expires at 1h)

/** Set the auth cookie so server routes (e.g. API) can read the session. Export for use after sign-in. */
export const setSessionCookie = (accessToken: string) => {
  document.cookie = `sb-access-token=${accessToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

const clearSessionCookie = () => {
  document.cookie = 'sb-access-token=; path=/; max-age=0'
}

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

    // Set cookie from current session immediately so API routes see auth without waiting for refresh
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
