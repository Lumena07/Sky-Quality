import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isAdminOrQM } from '@/lib/permissions'
import { fetchRoleAssignmentOptions } from '@/lib/department-role-catalog'

/** GET: catalog rows for Admin user add/edit (same access as Admin page). */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!isAdminOrQM(roles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const options = await fetchRoleAssignmentOptions(supabase)
    return NextResponse.json(options)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to load role options' }, { status: 500 })
  }
}
