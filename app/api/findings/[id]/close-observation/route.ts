import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserRoles, canReviewFindingForAudit } from '@/lib/permissions'
import { isObservationPriority } from '@/lib/audit-deadlines'

/** POST: Quality Manager or audit auditor closes an observation finding (no CAP/CAT path). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: findingId } = await params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roles = await getCurrentUserRoles(supabase, user.id)
    const { data: finding, error: findErr } = await supabase
      .from('Finding')
      .select('id, auditId, priority, status')
      .eq('id', findingId)
      .single()

    if (findErr || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    if (!isObservationPriority((finding as { priority?: string | null }).priority)) {
      return NextResponse.json(
        { error: 'Only observation-priority findings can be closed this way' },
        { status: 400 }
      )
    }

    if (String((finding as { status?: string }).status).toUpperCase() === 'CLOSED') {
      return NextResponse.json({ error: 'Finding is already closed' }, { status: 400 })
    }

    const auditId = (finding as { auditId: string }).auditId
    const canClose = await canReviewFindingForAudit(supabase, user.id, auditId, roles)
    if (!canClose) {
      return NextResponse.json(
        { error: 'Only Quality Manager or an auditor on this audit can close an observation' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()
    const { data: updated, error: updErr } = await supabase
      .from('Finding')
      .update({
        status: 'CLOSED',
        closedDate: now,
        closedBy: user.id,
        updatedAt: now,
      })
      .eq('id', findingId)
      .select()
      .single()

    if (updErr || !updated) {
      console.error('close-observation update error', updErr)
      return NextResponse.json({ error: 'Failed to close finding' }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('close-observation:', error)
    return NextResponse.json({ error: 'Failed to close observation' }, { status: 500 })
  }
}
