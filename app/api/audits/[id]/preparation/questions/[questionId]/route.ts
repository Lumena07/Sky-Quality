import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getAuditorAndAuditeeIdsForAudit } from '@/lib/audit-participants'
import { getCurrentUserProfile, canEditAudit } from '@/lib/permissions'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; questionId: string } }
) {
  try {
    const { id: auditId, questionId } = params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { auditorIds, auditeeIds } = await getAuditorAndAuditeeIdsForAudit(supabase, auditId)

    if (!canEditAudit(roles, user.id, auditorIds, auditeeIds)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: existing, error: findError } = await supabase
      .from('AuditPreparationQuestion')
      .select('id, auditId')
      .eq('id', questionId)
      .single()

    if (findError || !existing || (existing as { auditId: string }).auditId !== auditId) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const body = await request.json()
    const updatePayload: { questionText?: string; sortOrder?: number } = {}

    if (body.questionText !== undefined) {
      const text = typeof body.questionText === 'string' ? body.questionText.trim() : ''
      if (!text) {
        return NextResponse.json({ error: 'questionText cannot be empty' }, { status: 400 })
      }
      updatePayload.questionText = text
    }
    if (body.sortOrder !== undefined) {
      const n = Number(body.sortOrder)
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'sortOrder must be a non-negative number' }, { status: 400 })
      }
      updatePayload.sortOrder = Math.floor(n)
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'Provide questionText and/or sortOrder' },
        { status: 400 }
      )
    }

    const { data: row, error: updateError } = await supabase
      .from('AuditPreparationQuestion')
      .update(updatePayload)
      .eq('id', questionId)
      .eq('auditId', auditId)
      .select('id, sortOrder, questionText, createdAt, createdById')
      .single()

    if (updateError) {
      console.error('Error updating preparation question:', updateError)
      return NextResponse.json(
        { error: 'Failed to update question' },
        { status: 500 }
      )
    }

    return NextResponse.json(row)
  } catch (err) {
    console.error('Error in PATCH preparation/questions/[questionId]:', err)
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; questionId: string } }
) {
  try {
    const { id: auditId, questionId } = params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { auditorIds, auditeeIds } = await getAuditorAndAuditeeIdsForAudit(supabase, auditId)

    if (!canEditAudit(roles, user.id, auditorIds, auditeeIds)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: deleted, error: delError } = await supabase
      .from('AuditPreparationQuestion')
      .delete()
      .eq('id', questionId)
      .eq('auditId', auditId)
      .select('id')

    if (delError) {
      console.error('Error deleting preparation question:', delError)
      return NextResponse.json(
        { error: 'Failed to delete question' },
        { status: 500 }
      )
    }

    if (!deleted?.length) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error in DELETE preparation/questions/[questionId]:', err)
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    )
  }
}
