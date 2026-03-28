import { randomUUID } from 'crypto'
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

export async function GET(request: Request) {
  const { error, supabase } = await requireQm()
  if (error) return error
  try {
    const { searchParams } = new URL(request.url)
    const deptFilter = searchParams.get('departmentId')?.trim()
    let query = supabase!.from('DepartmentRoleCatalog').select(selectWithDept).order('departmentId').order('name')
    if (deptFilter) {
      query = query.eq('departmentId', deptFilter)
    }
    const { data, error: e } = await query
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to list department roles' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { error, supabase } = await requireQm()
  if (error) return error
  try {
    const body = (await request.json()) as {
      departmentId?: string
      name?: string
      roleCode?: string
      description?: string | null
      isActive?: boolean
    }
    const departmentId = typeof body.departmentId === 'string' ? body.departmentId.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const roleCodeRaw = typeof body.roleCode === 'string' ? normalizeRoleCode(body.roleCode) : ''
    if (!departmentId || !name) {
      return NextResponse.json({ error: 'departmentId and name are required' }, { status: 400 })
    }
    if (!roleCodeRaw || !isDepartmentCatalogRoleCode(roleCodeRaw)) {
      return NextResponse.json(
        {
          error:
            'roleCode must be one of the fixed catalog codes (e.g. STAFF, QUALITY_MANAGER, PILOT).',
        },
        { status: 400 }
      )
    }

    const { data: dept, error: deptErr } = await supabase!
      .from('Department')
      .select('id, isActive')
      .eq('id', departmentId)
      .maybeSingle()
    if (deptErr || !dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 400 })
    }
    if (!dept.isActive) {
      return NextResponse.json({ error: 'Cannot add roles to an inactive department' }, { status: 400 })
    }

    const { data: dup } = await supabase!
      .from('DepartmentRoleCatalog')
      .select('id')
      .eq('departmentId', departmentId)
      .ilike('name', name)
      .maybeSingle()
    if (dup) {
      return NextResponse.json({ error: 'A role with this name already exists for this department' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    const isActive = body.isActive !== false
    const description =
      typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null

    const { data, error: e } = await supabase!
      .from('DepartmentRoleCatalog')
      .insert({
        id,
        departmentId,
        name,
        roleCode: roleCodeRaw,
        description,
        isActive,
        createdAt: now,
        updatedAt: now,
      })
      .select(selectWithDept)
      .single()
    if (e) {
      console.error(e)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create department role' }, { status: 500 })
  }
}
