import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabaseServer'

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const organizationId = searchParams.get('organizationId')

    let query = supabase
      .from('User')
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
        organizationId,
        Department:departmentId (
          id,
          name
        )
      `
      )
      .order('lastName', { ascending: true })

    if (!includeInactive) {
      query = query.eq('isActive', true)
    }
    if (organizationId && organizationId.trim()) {
      query = query.eq('organizationId', organizationId.trim())
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching users from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    return NextResponse.json(users ?? [])
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
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

    const body = await request.json()
    const {
      email,
      password,
      firstName,
      lastName,
      roles: rolesBody,
      departmentId,
      organizationId,
      position,
      phone,
    } = body

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password is required and must be at least 6 characters' },
        { status: 400 }
      )
    }
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      )
    }
    if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 }
      )
    }

    const validRoles = [
      'SYSTEM_ADMIN',
      'QUALITY_MANAGER',
      'AUDITOR',
      'DEPARTMENT_HEAD',
      'STAFF',
      'FOCAL_PERSON',
    ]
    const roles: string[] = Array.isArray(rolesBody)
      ? rolesBody.filter((r: unknown) => typeof r === 'string' && validRoles.includes(r.trim()))
      : []
    if (roles.length === 0) {
      return NextResponse.json(
        { error: 'At least one role is required' },
        { status: 400 }
      )
    }

    const emailNormalized = email.trim().toLowerCase()

    let adminClient: ReturnType<typeof createSupabaseAdminClient>
    try {
      adminClient = createSupabaseAdminClient()
    } catch {
      return NextResponse.json(
        {
          error:
            'Server is not configured for adding users. Set SUPABASE_SERVICE_ROLE_KEY in .env.',
        },
        { status: 503 }
      )
    }

    const { data: authData, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email: emailNormalized,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      })

    if (createUserError) {
      if (
        createUserError.message?.toLowerCase().includes('already been registered') ||
        createUserError.message?.toLowerCase().includes('already exists')
      ) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        )
      }
      console.error('Error creating auth user:', createUserError)
      return NextResponse.json(
        { error: createUserError.message || 'Failed to create user' },
        { status: 500 }
      )
    }

    const authUserId = authData.user?.id
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Failed to create auth user' },
        { status: 500 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const now = new Date().toISOString()
    const userRow: Record<string, unknown> = {
      id: authUserId,
      email: emailNormalized,
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roles,
      departmentId:
        departmentId && String(departmentId).trim() ? String(departmentId).trim() : null,
      organizationId:
        organizationId && String(organizationId).trim() ? String(organizationId).trim() : null,
      position:
        position && String(position).trim() ? String(position).trim() : null,
      phone: phone && String(phone).trim() ? String(phone).trim() : null,
      isActive: true,
      updatedAt: now,
    }
    if (roles[0]) userRow.role = roles[0]

    const { data: newUser, error: insertError } = await adminClient
      .from('User')
      .insert(userRow)
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

    if (insertError) {
      console.error('Error inserting User row:', insertError)
      await adminClient.auth.admin.deleteUser(authUserId)
      return NextResponse.json(
        { error: insertError.message || 'Failed to create user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
