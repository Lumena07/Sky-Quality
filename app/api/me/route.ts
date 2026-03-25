import { NextResponse } from 'next/server'
import { normalizeAppUserRoles } from '@/lib/permissions'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

/** Returns current user id and roles for permission checks on the client. */
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

    const { data: profile, error: profileError } = await supabase
      .from('User')
      .select(
        'id, email, roles, role, departmentId, organizationId, safetyOperationalArea, firstName, lastName'
      )
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        {
          id: user.id,
          email: user.email ?? null,
          roles: [],
          departmentId: null,
          organizationId: null,
          safetyOperationalArea: null,
          firstName: null,
          lastName: null,
        },
        { status: 200 }
      )
    }

    const rawRoles = Array.isArray(profile.roles) && profile.roles.length > 0
      ? profile.roles
      : profile.role
        ? [profile.role]
        : []
    const roles = normalizeAppUserRoles(
      rawRoles.filter((x: unknown): x is string => typeof x === 'string')
    )

    return NextResponse.json({
      id: profile.id,
      email: profile.email ?? user.email ?? null,
      roles,
      departmentId: profile.departmentId ?? null,
      organizationId: profile.organizationId ?? null,
      safetyOperationalArea: profile.safetyOperationalArea ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
    })
  } catch (error) {
    console.error('Error in /api/me:', error)
    return NextResponse.json(
      { error: 'Failed to get current user' },
      { status: 500 }
    )
  }
}
