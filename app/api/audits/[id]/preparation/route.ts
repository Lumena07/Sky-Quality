import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getAuditorAndAuditeeIdsForAudit } from '@/lib/audit-participants'
import { getCurrentUserProfile, canEditAudit } from '@/lib/permissions'

export async function GET(
  _request: Request,
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

    const { data: audit, error: auditError } = await supabase
      .from('Audit')
      .select(
        `
        id,
        type,
        departmentId,
        preparationPriorFindingsReviewedAt,
        preparationPriorFindingsReviewedById,
        preparationStandardsReviewedAt,
        preparationStandardsReviewedById
      `
      )
      .eq('id', auditId)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const { data: questions, error: qError } = await supabase
      .from('AuditPreparationQuestion')
      .select('id, sortOrder, questionText, createdAt, createdById')
      .eq('auditId', auditId)
      .order('sortOrder', { ascending: true })
      .order('createdAt', { ascending: true })

    if (qError) {
      console.error('Error fetching preparation questions:', qError)
      return NextResponse.json(
        { error: 'Failed to fetch preparation data' },
        { status: 500 }
      )
    }

    const reviewerIds = [
      audit.preparationPriorFindingsReviewedById,
      audit.preparationStandardsReviewedById,
    ].filter(Boolean) as string[]
    const uniqueReviewerIds = Array.from(new Set(reviewerIds))

    let reviewerMap: Record<
      string,
      { id: string; firstName: string | null; lastName: string | null }
    > = {}
    if (uniqueReviewerIds.length > 0) {
      const { data: users } = await supabase
        .from('User')
        .select('id, firstName, lastName')
        .in('id', uniqueReviewerIds)
      if (users?.length) {
        reviewerMap = Object.fromEntries(users.map((u) => [u.id, u]))
      }
    }

    return NextResponse.json({
      ...audit,
      preparationPriorFindingsReviewedBy: audit.preparationPriorFindingsReviewedById
        ? reviewerMap[audit.preparationPriorFindingsReviewedById] ?? null
        : null,
      preparationStandardsReviewedBy: audit.preparationStandardsReviewedById
        ? reviewerMap[audit.preparationStandardsReviewedById] ?? null
        : null,
      questions: questions ?? [],
    })
  } catch (err) {
    console.error('Error in GET /api/audits/[id]/preparation:', err)
    return NextResponse.json(
      { error: 'Failed to fetch preparation' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors assigned to this audit can edit preparation' },
        { status: 403 }
      )
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
    const priorFindingsReviewed = body.priorFindingsReviewed as boolean | undefined
    const standardsReviewed = body.standardsReviewed as boolean | undefined

    if (priorFindingsReviewed === undefined && standardsReviewed === undefined) {
      return NextResponse.json(
        { error: 'Provide priorFindingsReviewed and/or standardsReviewed' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const updatePayload: Record<string, string | null> = {}

    if (priorFindingsReviewed === true) {
      updatePayload.preparationPriorFindingsReviewedAt = now
      updatePayload.preparationPriorFindingsReviewedById = user.id
    } else if (priorFindingsReviewed === false) {
      updatePayload.preparationPriorFindingsReviewedAt = null
      updatePayload.preparationPriorFindingsReviewedById = null
    }

    if (standardsReviewed === true) {
      updatePayload.preparationStandardsReviewedAt = now
      updatePayload.preparationStandardsReviewedById = user.id
    } else if (standardsReviewed === false) {
      updatePayload.preparationStandardsReviewedAt = null
      updatePayload.preparationStandardsReviewedById = null
    }

    const { error: updateError } = await supabase.from('Audit').update(updatePayload).eq('id', auditId)

    if (updateError) {
      console.error('Error updating audit preparation:', updateError)
      return NextResponse.json(
        { error: 'Failed to update preparation' },
        { status: 500 }
      )
    }

    const { data: audit } = await supabase
      .from('Audit')
      .select(
        `
        id,
        type,
        departmentId,
        preparationPriorFindingsReviewedAt,
        preparationPriorFindingsReviewedById,
        preparationStandardsReviewedAt,
        preparationStandardsReviewedById
      `
      )
      .eq('id', auditId)
      .single()

    const reviewerIds = [
      audit?.preparationPriorFindingsReviewedById,
      audit?.preparationStandardsReviewedById,
    ].filter(Boolean) as string[]
    const uniqueReviewerIds = Array.from(new Set(reviewerIds))

    let reviewerMap: Record<
      string,
      { id: string; firstName: string | null; lastName: string | null }
    > = {}
    if (uniqueReviewerIds.length > 0) {
      const { data: users } = await supabase
        .from('User')
        .select('id, firstName, lastName')
        .in('id', uniqueReviewerIds)
      if (users?.length) {
        reviewerMap = Object.fromEntries(users.map((u) => [u.id, u]))
      }
    }

    const { data: questions } = await supabase
      .from('AuditPreparationQuestion')
      .select('id, sortOrder, questionText, createdAt, createdById')
      .eq('auditId', auditId)
      .order('sortOrder', { ascending: true })
      .order('createdAt', { ascending: true })

    return NextResponse.json({
      ...audit,
      preparationPriorFindingsReviewedBy: audit?.preparationPriorFindingsReviewedById
        ? reviewerMap[audit.preparationPriorFindingsReviewedById] ?? null
        : null,
      preparationStandardsReviewedBy: audit?.preparationStandardsReviewedById
        ? reviewerMap[audit.preparationStandardsReviewedById] ?? null
        : null,
      questions: questions ?? [],
    })
  } catch (err) {
    console.error('Error in PATCH /api/audits/[id]/preparation:', err)
    return NextResponse.json(
      { error: 'Failed to update preparation' },
      { status: 500 }
    )
  }
}
