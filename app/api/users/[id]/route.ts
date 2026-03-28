import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { fetchActiveCatalogRoleCodes, USER_PLATFORM_ROLE_CODES } from '@/lib/department-role-catalog'
import { rolesFromUserRow, sanitizeRoleMetadataForRoles } from '@/lib/role-metadata'

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

    const { id } = await params
    const body = await request.json()

    const needExistingRow =
      Array.isArray(body.roles) ||
      (typeof body.role === 'string' && body.role.trim()) ||
      body.roleMetadata !== undefined

    let existingRow: {
      roles: unknown
      role: string | null
      roleMetadata: unknown
    } | null = null
    if (needExistingRow) {
      const { data, error: rowErr } = await supabase
        .from('User')
        .select('roles, role, roleMetadata')
        .eq('id', id)
        .single()
      if (rowErr || !data) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      existingRow = data
    }

    const allowedFromCatalog = await fetchActiveCatalogRoleCodes(supabase)
    const allowedSet = new Set<string>([...allowedFromCatalog, ...USER_PLATFORM_ROLE_CODES])
    const updates: Record<string, unknown> = {}
    if (Array.isArray(body.roles)) {
      if (allowedFromCatalog.length === 0) {
        return NextResponse.json(
          {
            error:
              'No active roles in the department role catalog. Configure catalog entries in Admin → Department roles.',
          },
          { status: 400 }
        )
      }
      if (body.roles.length === 0) {
        return NextResponse.json({ error: 'At least one role is required' }, { status: 400 })
      }
      const trimmedRoles: string[] = body.roles
        .filter((r: unknown) => typeof r === 'string' && allowedSet.has(String(r).trim()))
        .map((r: string) => String(r).trim())
      const roles = trimmedRoles.filter((role: string, index: number) => trimmedRoles.indexOf(role) === index)
      if (roles.length === 0) {
        return NextResponse.json(
          {
            error:
              'Each role must match an active catalog entry or be FOCAL_PERSON / SYSTEM_ADMIN.',
          },
          { status: 400 }
        )
      }
      updates.roles = roles
      updates.role = roles[0]
      if (roles.includes('SAFETY_OFFICER')) {
        const validSafetyAreas = ['airline_ops', 'mro_maintenance', 'airport_ground_ops', 'all', 'other']
        const area =
          typeof body.safetyOperationalArea === 'string' && validSafetyAreas.includes(body.safetyOperationalArea)
            ? body.safetyOperationalArea
            : null
        if (!area) {
          return NextResponse.json(
            { error: 'Safety operational area is required for Safety Officer role' },
            { status: 400 }
          )
        }
        updates.safetyOperationalArea = area
      } else {
        updates.safetyOperationalArea = null
      }
    } else if (typeof body.role === 'string' && body.role.trim()) {
      const r = body.role.trim()
      if (allowedFromCatalog.length === 0 || !allowedSet.has(r)) {
        return NextResponse.json(
          {
            error:
              'Role must exist in the active department role catalog or be FOCAL_PERSON / SYSTEM_ADMIN.',
          },
          { status: 400 }
        )
      }
      updates.role = r
      updates.roles = [r]
      if (r === 'SAFETY_OFFICER') {
        const validSafetyAreas = ['airline_ops', 'mro_maintenance', 'airport_ground_ops', 'all', 'other']
        const area =
          typeof body.safetyOperationalArea === 'string' && validSafetyAreas.includes(body.safetyOperationalArea)
            ? body.safetyOperationalArea
            : null
        if (!area) {
          return NextResponse.json(
            { error: 'Safety operational area is required for Safety Officer role' },
            { status: 400 }
          )
        }
        updates.safetyOperationalArea = area
      } else {
        updates.safetyOperationalArea = null
      }
    }
    if (body.departmentId !== undefined) updates.departmentId = body.departmentId === '' ? null : body.departmentId
    if (body.organizationId !== undefined) updates.organizationId = body.organizationId === '' ? null : body.organizationId
    if (typeof body.isActive === 'boolean') updates.isActive = body.isActive
    if (typeof body.position === 'string') updates.position = body.position.trim() || null
    if (typeof body.phone === 'string') updates.phone = body.phone.trim() || null
    if (typeof body.firstName === 'string' && body.firstName.trim()) updates.firstName = body.firstName.trim()
    if (typeof body.lastName === 'string' && body.lastName.trim()) updates.lastName = body.lastName.trim()

    if (updates.roles !== undefined || body.roleMetadata !== undefined) {
      if (!existingRow) {
        return NextResponse.json({ error: 'Internal error: profile not loaded' }, { status: 500 })
      }
      const finalRoles =
        Array.isArray(updates.roles) && updates.roles.length > 0
          ? (updates.roles as string[])
          : rolesFromUserRow(existingRow)
      const rawMeta =
        body.roleMetadata !== undefined ? body.roleMetadata : existingRow.roleMetadata
      const metaRes = sanitizeRoleMetadataForRoles(finalRoles, rawMeta ?? {})
      if (!metaRes.ok) {
        return NextResponse.json({ error: metaRes.error }, { status: 400 })
      }
      updates.roleMetadata = metaRes.value
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: updated, error } = await supabase
      .from('User')
      .update(updates)
      .eq('id', id)
      .select(
        `
        id,
        email,
        firstName,
        lastName,
        role,
        roles,
        position,
        safetyOperationalArea,
        roleMetadata,
        isActive,
        Department:departmentId (
          id,
          name
        )
      `
      )
      .single()

    if (error) {
      console.error('Error updating user in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}
