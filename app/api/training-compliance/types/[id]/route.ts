import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageTrainingCompliance, getCurrentUserProfile } from '@/lib/permissions'
import {
  parseRoleCodes,
  parseStringIdArray,
  stripExcludedRolesFromComplianceAudience,
} from '@/lib/training-compliance-applicability'
import { ensureComplianceTrainingCompletionRows } from '@/lib/training-compliance-ensure'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const { data: existing, error: exErr } = await supabase
      .from('ComplianceTrainingType')
      .select('isSystemSeeded')
      .eq('id', id)
      .maybeSingle()
    if (exErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if ((existing as { isSystemSeeded?: boolean }).isSystemSeeded) {
      return NextResponse.json({ error: 'Cannot edit system training type' }, { status: 400 })
    }
    const body = await request.json()
    const update: Record<string, unknown> = {}
    if (body.name !== undefined) update.name = String(body.name).trim()
    if (body.intervalMonths !== undefined) {
      const n = parseInt(String(body.intervalMonths), 10)
      if (Number.isNaN(n) || n < 1) {
        return NextResponse.json({ error: 'Invalid intervalMonths' }, { status: 400 })
      }
      update.intervalMonths = n
    }
    if (body.mandatoryForAll !== undefined) update.mandatoryForAll = Boolean(body.mandatoryForAll)
    if (body.applicableRoles !== undefined) {
      const raw =
        Array.isArray(body.applicableRoles) && body.applicableRoles.length > 0
          ? parseRoleCodes(body.applicableRoles)
          : []
      const cleaned = stripExcludedRolesFromComplianceAudience(raw)
      update.applicableRoles = cleaned.length > 0 ? cleaned : null
    }
    if (body.applicableUserIds !== undefined) {
      update.applicableUserIds =
        Array.isArray(body.applicableUserIds) && body.applicableUserIds.length > 0
          ? parseStringIdArray(body.applicableUserIds)
          : null
    }
    if (body.applicableDepartmentIds !== undefined) {
      update.applicableDepartmentIds =
        Array.isArray(body.applicableDepartmentIds) && body.applicableDepartmentIds.length > 0
          ? parseStringIdArray(body.applicableDepartmentIds)
          : null
    }
    if (body.applicableRoleMetadata !== undefined) {
      const m = body.applicableRoleMetadata
      update.applicableRoleMetadata =
        typeof m === 'object' && m !== null && !Array.isArray(m) && Object.keys(m).length > 0
          ? (m as Record<string, unknown>)
          : null
    }
    const { data, error } = await supabase
      .from('ComplianceTrainingType')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
    await ensureComplianceTrainingCompletionRows(supabase)
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const { data: existing } = await supabase
      .from('ComplianceTrainingType')
      .select('isSystemSeeded')
      .eq('id', id)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if ((existing as { isSystemSeeded?: boolean }).isSystemSeeded) {
      return NextResponse.json({ error: 'Cannot delete system training type' }, { status: 400 })
    }
    const { error } = await supabase.from('ComplianceTrainingType').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
