import { NextRequest, NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portal = request.nextUrl.searchParams.get('portal')
  const manage = canManageSmsPolicy(profile.roles)

  let query = supabase.from('sms_documents').select('*').order('document_number').order('revision_number')

  if (portal === 'my-safety') {
    query = supabase
      .from('sms_documents')
      .select('*')
      .eq('status', 'PUBLISHED')
      .eq('visible_to_all_staff', true)
      .eq('is_superseded', false)
      .order('title')
  } else if (!manage) {
    query = supabase
      .from('sms_documents')
      .select('*')
      .eq('status', 'PUBLISHED')
      .eq('is_superseded', false)
      .order('document_number')
      .order('revision_number')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canManageSmsPolicy(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    documentNumber?: string
    revisionNumber?: string
    title?: string
    documentType?: string
    status?: string
    effectiveDate?: string | null
    reviewDate?: string | null
    fileUrl?: string | null
    visibleToAllStaff?: boolean
  }

  if (!body.documentNumber?.trim() || !body.title?.trim()) {
    return NextResponse.json({ error: 'documentNumber and title are required' }, { status: 400 })
  }

  const status = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const nowIso = new Date().toISOString()

  const payload = {
    document_number: body.documentNumber.trim(),
    revision_number: (body.revisionNumber ?? '1').trim() || '1',
    title: body.title.trim(),
    document_type: body.documentType?.trim() || 'SMS Manual',
    owner_id: user.id,
    status,
    effective_date: body.effectiveDate || null,
    review_date: body.reviewDate || null,
    file_url: body.fileUrl || null,
    visible_to_all_staff: Boolean(body.visibleToAllStaff),
    is_superseded: false,
    published_at: status === 'PUBLISHED' ? nowIso : null,
  }

  const { data, error } = await supabase.from('sms_documents').insert(payload).select('*').single()
  if (error || !data) {
    console.error('sms_documents insert', error)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_documents',
    recordId: String(data.id),
    newValue: data,
  })

  return NextResponse.json(data, { status: 201 })
}
