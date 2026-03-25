import { NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canManageSmsPolicy(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const body = (await request.json()) as {
    action?: string
    revisionNumber?: string
    title?: string
    documentType?: string
    status?: string
    effectiveDate?: string | null
    reviewDate?: string | null
    fileUrl?: string | null
    visibleToAllStaff?: boolean
  }

  if (body.action !== 'revise') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { data: prev, error: fetchErr } = await supabase
    .from('sms_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !prev) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (prev.is_superseded) {
    return NextResponse.json({ error: 'Cannot revise a superseded revision' }, { status: 400 })
  }

  const newRev = (body.revisionNumber ?? '').trim() || String(parseInt(String(prev.revision_number).replace(/\D/g, '') || '0', 10) + 1)
  const nowIso = new Date().toISOString()

  const { error: supersedeErr } = await supabase
    .from('sms_documents')
    .update({ is_superseded: true, updated_at: nowIso })
    .eq('id', id)

  if (supersedeErr) {
    console.error('sms_documents supersede', supersedeErr)
    return NextResponse.json({ error: 'Failed to supersede previous revision' }, { status: 500 })
  }

  const insertPayload = {
    document_number: prev.document_number,
    revision_number: newRev,
    title: (body.title ?? prev.title).trim(),
    document_type: (body.documentType ?? prev.document_type).trim(),
    owner_id: user.id,
    status: 'PUBLISHED',
    effective_date: body.effectiveDate !== undefined ? body.effectiveDate : prev.effective_date,
    review_date: body.reviewDate !== undefined ? body.reviewDate : prev.review_date,
    file_url: body.fileUrl !== undefined ? body.fileUrl : prev.file_url,
    visible_to_all_staff:
      body.visibleToAllStaff !== undefined ? Boolean(body.visibleToAllStaff) : prev.visible_to_all_staff,
    is_superseded: false,
    published_at: nowIso,
  }

  const { data: created, error: insertErr } = await supabase
    .from('sms_documents')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertErr || !created) {
    console.error('sms_documents revise insert', insertErr)
    return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 })
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'UPDATE',
    module: 'sms_documents',
    recordId: String(created.id),
    oldValue: prev,
    newValue: created,
  })

  return NextResponse.json(created)
}
