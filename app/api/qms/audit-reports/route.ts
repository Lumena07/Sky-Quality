import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isQualityManager } from '@/lib/permissions'

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
    if (!isQualityManager(roles)) {
      return NextResponse.json({ error: 'Quality Manager only' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('TcaaAuditReportLog')
      .select(
        `
        *,
        GeneratedBy:generatedById ( id, firstName, lastName, email )
      `
      )
      .order('generatedAt', { ascending: false })
      .limit(100)

    if (error) {
      console.error('TcaaAuditReportLog list', error)
      return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}
