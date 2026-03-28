import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canAddTraining, canSeeTraining, getCurrentUserProfile } from '@/lib/permissions'

/** PATCH: record requalification course completion for an auditor. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeTraining(roles, departmentId) || !canAddTraining(roles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { userId } = await params
    const body = await request.json()
    const completedAt =
      body.auditorRequalificationCompletedAt && typeof body.auditorRequalificationCompletedAt === 'string'
        ? new Date(body.auditorRequalificationCompletedAt).toISOString()
        : new Date().toISOString()
    const notes =
      typeof body.auditorRequalificationCourseNotes === 'string'
        ? body.auditorRequalificationCourseNotes.trim() || null
        : null

    const { data, error } = await supabase
      .from('User')
      .update({
        auditorRequalificationCompletedAt: completedAt,
        auditorRequalificationCourseNotes: notes,
      })
      .eq('id', userId)
      .select('id, auditorRequalificationCompletedAt, auditorRequalificationCourseNotes')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
