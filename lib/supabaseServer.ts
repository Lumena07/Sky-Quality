import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const createSupabaseServerClient = () => {
  const cookieStore = cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const accessToken = cookieStore.get('sb-access-token')?.value

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  })

  return client
}

export const getServerSession = async () => {
  const supabase = createSupabaseServerClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  return { data: { session }, error }
}

/** Server-only. Uses service role to create auth users (admin adds users; no self-sign-up). */
export const createSupabaseAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

