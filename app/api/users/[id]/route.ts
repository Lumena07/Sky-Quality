import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

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

    const validRoles = [
      'QUALITY_MANAGER',
      'ACCOUNTABLE_MANAGER',
      'AUDITOR',
      'DEPARTMENT_HEAD',
      'STAFF',
      'FOCAL_PERSON',
    ]
    const updates: Record<string, unknown> = {}
    if (Array.isArray(body.roles)) {
      const roles = body.roles.filter(
        (r: unknown) => typeof r === 'string' && validRoles.includes(String(r).trim())
      )
      if (roles.length > 0) {
        updates.roles = roles
        updates.role = roles[0]
      }
    } else if (typeof body.role === 'string' && body.role.trim()) {
      updates.role = body.role.trim()
      updates.roles = [body.role.trim()]
    }
    if (body.departmentId !== undefined) updates.departmentId = body.departmentId === '' ? null : body.departmentId
    if (body.organizationId !== undefined) updates.organizationId = body.organizationId === '' ? null : body.organizationId
    if (typeof body.isActive === 'boolean') updates.isActive = body.isActive
    if (typeof body.position === 'string') updates.position = body.position.trim() || null
    if (typeof body.phone === 'string') updates.phone = body.phone.trim() || null
    if (typeof body.firstName === 'string' && body.firstName.trim()) updates.firstName = body.firstName.trim()
    if (typeof body.lastName === 'string' && body.lastName.trim()) updates.lastName = body.lastName.trim()

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
