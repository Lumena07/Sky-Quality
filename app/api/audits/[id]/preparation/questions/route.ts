import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getAuditorAndAuditeeIdsForAudit } from '@/lib/audit-participants'
import { getCurrentUserProfile, canEditAudit } from '@/lib/permissions'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auditId = params.id
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

    const { data: auditRow, error: typeErr } = await supabase
      .from('Audit')
      .select('type')
      .eq('id', auditId)
      .single()

    if (typeErr || !auditRow) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if ((auditRow as { type?: string }).type === 'ERP') {
      return NextResponse.json(
        { error: 'Audit preparation does not apply to ERP audits' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const questionText = typeof body.questionText === 'string' ? body.questionText.trim() : ''
    if (!questionText) {
      return NextResponse.json({ error: 'questionText is required' }, { status: 400 })
    }

    const { data: maxRow } = await supabase
      .from('AuditPreparationQuestion')
      .select('sortOrder')
      .eq('auditId', auditId)
      .order('sortOrder', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder =
      maxRow && typeof (maxRow as { sortOrder?: number }).sortOrder === 'number'
        ? (maxRow as { sortOrder: number }).sortOrder + 1
        : 0

    const id = randomUUID()
    const { data: row, error: insertError } = await supabase
      .from('AuditPreparationQuestion')
      .insert({
        id,
        auditId,
        sortOrder: nextOrder,
        questionText,
        createdById: user.id,
      })
      .select('id, sortOrder, questionText, createdAt, createdById')
      .single()

    if (insertError) {
      console.error('Error inserting preparation question:', insertError)
      return NextResponse.json(
        { error: 'Failed to create question' },
        { status: 500 }
      )
    }

    return NextResponse.json(row)
  } catch (err) {
    console.error('Error in POST preparation/questions:', err)
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    )
  }
}
