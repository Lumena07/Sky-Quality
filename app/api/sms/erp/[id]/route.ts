import { NextRequest, NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

type RouteContext = { params: Promise<{ id: string }> }

const loadDrillsAndContacts = async (
  supabase: Exclude<Awaited<ReturnType<typeof getSmsAuthContext>>['supabase'], undefined>,
  erpId: string
) => {
  const [{ data: drills, error: e1 }, { data: contacts, error: e2 }] = await Promise.all([
    supabase
      .from('sms_erp_drills')
      .select('*')
      .eq('erp_id', erpId)
      .order('planned_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('sms_erp_contacts').select('*').eq('erp_id', erpId).order('created_at', { ascending: true }),
  ])
  if (e1 || e2) return { error: 'Failed to load drills or contacts' as const, drills: [], contacts: [] }
  return { error: null as null, drills: drills ?? [], contacts: contacts ?? [] }
}

export const GET = async (_request: NextRequest, context: RouteContext) => {
  const { id } = await context.params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: erp, error } = await supabase.from('sms_erp').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Failed to fetch ERP' }, { status: 500 })
  if (!erp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isPublished = String(erp.status) === 'PUBLISHED'
  if (!isPublished && !canManageSmsPolicy(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { drills, contacts, error: childError } = await loadDrillsAndContacts(supabase, id)
  if (childError) return NextResponse.json({ error: childError }, { status: 500 })

  return NextResponse.json({ ...erp, drills, contacts })
}

export const PATCH = async (request: Request, context: RouteContext) => {
  const { id } = await context.params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPolicy(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing, error: fetchErr } = await supabase.from('sms_erp').select('*').eq('id', id).maybeSingle()
  if (fetchErr) return NextResponse.json({ error: 'Failed to fetch ERP' }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const nextStatus = body.status !== undefined ? body.status : existing.status
  const wasPublished = String(existing.status) === 'PUBLISHED'
  const nowPublished = String(nextStatus) === 'PUBLISHED'

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (body.versionNumber !== undefined) updates.version_number = body.versionNumber
  if (body.erpText !== undefined) updates.erp_text = body.erpText
  if (body.fileUrl !== undefined) updates.file_url = body.fileUrl
  if (body.reviewCycleMonths !== undefined) updates.review_cycle_months = Number(body.reviewCycleMonths) || 12
  if (body.nextReviewDate !== undefined) updates.next_review_date = body.nextReviewDate || null
  if (body.status !== undefined) updates.status = body.status
  if (body.sectionsJson !== undefined) updates.sections_json = body.sectionsJson

  if (nowPublished && !wasPublished) {
    updates.published_at = new Date().toISOString()
  }
  if (!nowPublished && body.status !== undefined) {
    updates.published_at = null
  }

  const { data, error } = await supabase.from('sms_erp').update(updates).eq('id', id).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to update ERP' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_erp',
    recordId: String(id),
    oldValue: existing,
    newValue: data,
  })

  const { drills, contacts, error: childError } = await loadDrillsAndContacts(supabase, id)
  if (childError) return NextResponse.json({ error: childError }, { status: 500 })

  return NextResponse.json({ ...data, drills, contacts })
}
