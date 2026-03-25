import { NextRequest, NextResponse } from 'next/server'
import { canApproveSmsPolicy, canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

const fullPolicyAccess = (roles: string[]) => canManageSmsPolicy(roles) || canApproveSmsPolicy(roles)

export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mode = request.nextUrl.searchParams.get('mode')

  if (mode === 'portal') {
    const { data: active } = await supabase
      .from('sms_safety_policy')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const policyId = active?.id
    let objectives: unknown[] = []
    if (policyId) {
      const { data: objs } = await supabase
        .from('sms_safety_objectives')
        .select('*')
        .or(`policy_version_id.eq.${policyId},policy_version_id.is.null`)
      objectives = objs ?? []
    }

    return NextResponse.json({ policy: active ?? null, objectives })
  }

  if (!fullPolicyAccess(profile.roles)) {
    const { data: active } = await supabase
      .from('sms_safety_policy')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    return NextResponse.json(active ? [active] : [])
  }

  const { data, error } = await supabase
    .from('sms_safety_policy')
    .select('*')
    .order('effective_date', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to fetch policy' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canManageSmsPolicy(profile.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  const payload: Record<string, unknown> = {
    version_number: body.versionNumber,
    policy_text: body.policyText ?? null,
    file_url: body.fileUrl || null,
    effective_date: body.effectiveDate,
    review_due_date: body.reviewDueDate || null,
    status: body.status || 'DRAFT',
    created_by: user.id,
    submitted_for_signature_at: null,
    submitted_by_id: null,
  }

  const { data, error } = await supabase.from('sms_safety_policy').insert(payload).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'Failed to save policy' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_safety_policy',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
