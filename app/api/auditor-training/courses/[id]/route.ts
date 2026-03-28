import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canAddTraining, canSeeTraining, getCurrentUserProfile } from '@/lib/permissions'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params
    const body = await request.json()
    const update: Record<string, unknown> = {}
    if (body.title !== undefined) update.title = String(body.title).trim()
    if (body.description !== undefined) update.description = body.description ? String(body.description).trim() : null
    if (body.sortOrder !== undefined) update.sortOrder = parseInt(String(body.sortOrder), 10) || 0
    const { data, error } = await supabase
      .from('AuditorTrainingCourse')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params
    const { error } = await supabase.from('AuditorTrainingCourse').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
