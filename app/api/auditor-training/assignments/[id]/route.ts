import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canAddTraining, canSeeTraining, getCurrentUserProfile } from '@/lib/permissions'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

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

    const { error } = await supabase.from('AuditorTrainingAssignment').delete().eq('id', id.trim())
    if (error) {
      console.error('assignment delete', error)
      return NextResponse.json({ error: 'Failed to remove' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
