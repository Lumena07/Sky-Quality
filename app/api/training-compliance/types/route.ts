import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageTrainingCompliance, getCurrentUserProfile } from '@/lib/permissions'
import { sanitizeComplianceTypeAudienceFields } from '@/lib/training-compliance-applicability'
import { ensureComplianceTrainingCompletionRows } from '@/lib/training-compliance-ensure'

export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canManageTrainingCompliance(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { data, error } = await supabase
      .from('ComplianceTrainingType')
      .select('*')
      .order('name', { ascending: true })
    if (error) {
      return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canManageTrainingCompliance(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const intervalMonths = parseInt(String(body.intervalMonths), 10)
    if (!name || Number.isNaN(intervalMonths) || intervalMonths < 1) {
      return NextResponse.json({ error: 'name and positive intervalMonths required' }, { status: 400 })
    }
    const audience = sanitizeComplianceTypeAudienceFields(body as Record<string, unknown>)
    const now = new Date().toISOString()
    const row = {
      id: randomUUID(),
      name,
      intervalMonths,
      mandatoryForAll: Boolean(body.mandatoryForAll),
      applicableRoles: audience.applicableRoles,
      applicableUserIds: audience.applicableUserIds,
      applicableDepartmentIds: audience.applicableDepartmentIds,
      applicableRoleMetadata: audience.applicableRoleMetadata,
      isSystemSeeded: false,
      createdAt: now,
    }
    const { data, error } = await supabase.from('ComplianceTrainingType').insert(row).select('*').single()
    if (error || !data) {
      console.error('compliance type POST', error)
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }
    await ensureComplianceTrainingCompletionRows(supabase)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
