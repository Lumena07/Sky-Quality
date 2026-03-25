import { NextRequest, NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

export const GET = async (request: NextRequest) => {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portal = request.nextUrl.searchParams.get('portal')

  const publishedOnly = () =>
    supabase.from('sms_erp').select('*').eq('status', 'PUBLISHED').order('created_at', { ascending: false })

  if (portal === 'my-safety') {
    const { data, error } = await publishedOnly()
    if (error) return NextResponse.json({ error: 'Failed to fetch ERP' }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  if (canManageSmsPolicy(profile.roles)) {
    const { data, error } = await supabase.from('sms_erp').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: 'Failed to fetch ERP' }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  const { data, error } = await publishedOnly()
  if (error) return NextResponse.json({ error: 'Failed to fetch ERP' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export const POST = async (request: Request) => {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPolicy(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const status = body.status || 'DRAFT'

  const payload: Record<string, unknown> = {
    version_number: body.versionNumber,
    erp_text: body.erpText ?? null,
    file_url: body.fileUrl || null,
    review_cycle_months: Number(body.reviewCycleMonths) || 12,
    next_review_date: body.nextReviewDate || null,
    status,
    sections_json: body.sectionsJson ?? {},
    created_by: user.id,
    published_at: status === 'PUBLISHED' ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase.from('sms_erp').insert(payload).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create ERP' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_erp',
    recordId: String(data.id),
    newValue: data,
  })

  return NextResponse.json(data, { status: 201 })
}
