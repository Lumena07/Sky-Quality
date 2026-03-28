import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageTrainingCompliance, getCurrentUserProfile } from '@/lib/permissions'

const HISTORY_LIMIT = 50

/** GET: prior training completion snapshots for a user and type (newest first). */
export async function GET(request: Request) {
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
    if (!canManageTrainingCompliance(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = typeof searchParams.get('userId') === 'string' ? searchParams.get('userId')!.trim() : ''
    const trainingTypeId =
      typeof searchParams.get('trainingTypeId') === 'string' ? searchParams.get('trainingTypeId')!.trim() : ''
    if (!userId || !trainingTypeId) {
      return NextResponse.json({ error: 'userId and trainingTypeId required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ComplianceTrainingCompletionHistory')
      .select('id, createdAt, lastCompletedAt, nextDueAt, completionProofUrl, createdById')
      .eq('userId', userId)
      .eq('trainingTypeId', trainingTypeId)
      .order('createdAt', { ascending: false })
      .limit(HISTORY_LIMIT)

    if (error) {
      console.error('completion history list', error)
      return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
