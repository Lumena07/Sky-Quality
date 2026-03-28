import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isQualityManager } from '@/lib/permissions'
import { isDepartmentCatalogRoleCode, normalizeRoleCode } from '@/lib/department-role-catalog'

const requireQm = async () => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase: null }
  }
  const { roles } = await getCurrentUserProfile(supabase, user.id)
  if (!isQualityManager(roles)) {
    return {
      error: NextResponse.json({ error: 'Forbidden: Quality Manager only' }, { status: 403 }),
      supabase: null,
    }
  }
  return { error: null, supabase }
}

const selectWithDept = `
  id,
  departmentId,
  name,
  roleCode,
  description,
  isActive,
  createdAt,
  updatedAt,
  Department:departmentId ( id, name, code, isActive )
`

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await requireQm()
  if (error) return error
  const { id } = await params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    const body = (await request.json()) as {
      departmentId?: string
      name?: string
      roleCode?: string
      description?: string | null
      isActive?: boolean
    }

    const { data: existing, error: fetchErr } = await supabase!
      .from('DepartmentRoleCatalog')
      .select('id, departmentId, name')
      .eq('id', id.trim())
      .maybeSingle()
    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const nextDeptId =
      typeof body.departmentId === 'string' && body.departmentId.trim()
        ? body.departmentId.trim()
        : existing.departmentId
    const nextName =
      typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name

    if (typeof body.departmentId === 'string' && body.departmentId.trim()) {
      const { data: dept, error: deptErr } = await supabase!
        .from('Department')
        .select('id, isActive')
        .eq('id', nextDeptId)
        .maybeSingle()
      if (deptErr || !dept) {
        return NextResponse.json({ error: 'Department not found' }, { status: 400 })
      }
      if (!dept.isActive) {
        return NextResponse.json({ error: 'Cannot move a role to an inactive department' }, { status: 400 })
      }
    }

    if (nextName !== existing.name || nextDeptId !== existing.departmentId) {
      const { data: dup } = await supabase!
        .from('DepartmentRoleCatalog')
        .select('id')
        .eq('departmentId', nextDeptId)
        .ilike('name', nextName)
        .neq('id', id.trim())
        .maybeSingle()
      if (dup) {
        return NextResponse.json({ error: 'A role with this name already exists for this department' }, { status: 409 })
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (typeof body.departmentId === 'string' && body.departmentId.trim()) {
      updates.departmentId = nextDeptId
    }
    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = nextName
    }
    if (body.description !== undefined) {
      updates.description =
        typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null
    }
    if (typeof body.isActive === 'boolean') {
      updates.isActive = body.isActive
    }
    if (body.roleCode !== undefined) {
      const rc = typeof body.roleCode === 'string' ? normalizeRoleCode(body.roleCode) : ''
      if (!rc || !isDepartmentCatalogRoleCode(rc)) {
        return NextResponse.json(
          {
            error: 'Invalid roleCode. It must be one of the fixed department catalog codes.',
          },
          { status: 400 }
        )
      }
      updates.roleCode = rc
    }

    const { data, error: e } = await supabase!
      .from('DepartmentRoleCatalog')
      .update(updates)
      .eq('id', id.trim())
      .select(selectWithDept)
      .single()
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update department role' }, { status: 500 })
  }
}

/** Soft-delete: set isActive false (same pattern as KPI admin). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await requireQm()
  if (error) return error
  const { id } = await params
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    const { error: e } = await supabase!
      .from('DepartmentRoleCatalog')
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq('id', id.trim())
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to deactivate department role' }, { status: 500 })
  }
}
