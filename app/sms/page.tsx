import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isDirectorOfSafety } from '@/lib/permissions'

const SmsHomePage = async () => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/sms')
  }

  const profile = await getCurrentUserProfile(supabase, user.id)
  if (isDirectorOfSafety(profile.roles)) {
    redirect('/sms/assurance/dashboard')
  }
  redirect('/sms/dashboard')
}

export default SmsHomePage
