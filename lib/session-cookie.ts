const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/** Set the auth cookie so server routes (e.g. API) can read the session. */
export const setSessionCookie = (accessToken: string) => {
  if (typeof document === 'undefined') return
  document.cookie = `sb-access-token=${accessToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

export const clearSessionCookie = () => {
  if (typeof document === 'undefined') return
  document.cookie = 'sb-access-token=; path=/; max-age=0'
}
