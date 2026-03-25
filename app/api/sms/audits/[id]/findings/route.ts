import { NextResponse } from 'next/server'
import { canViewSmsProtectedData } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

const CATEGORIES = new Set(['OBSERVATION', 'NON_CONFORMANCE', 'MAJOR_NON_CONFORMANCE'])

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsProtectedData(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: audit, error: aErr } = await supabase.from('sms_audits').select('id').eq('id', params.id).single()
  if (aErr || !audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })

  const body = await request.json()
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const category = typeof body.category === 'string' ? body.category.toUpperCase() : ''
  if (!description || !CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'description and valid category required' }, { status: 400 })
  }

  const { count } = await supabase
    .from('sms_audit_findings')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', params.id)
  const seq = (count ?? 0) + 1
  const findingNumber =
    typeof body.findingNumber === 'string' && body.findingNumber.trim()
      ? body.findingNumber.trim()
      : `F-${String(seq).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('sms_audit_findings')
    .insert({
      audit_id: params.id,
      finding_number: findingNumber,
      description,
      category,
      linked_sms_element: body.linkedSmsElement ?? null,
      risk_level: body.riskLevel ?? null,
      linked_capa_id: body.linkedCapaId ?? null,
      status: 'OPEN',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create finding' }, { status: 500 })
  await createSmsAuditLog({
    userId: user.id,
    actionType: 'CREATE',
    module: 'sms_audit_findings',
    recordId: String(data.id),
    newValue: data,
  })
  return NextResponse.json(data, { status: 201 })
}
