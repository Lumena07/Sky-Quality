import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

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

    const { data: allUsers, error: fetchError } = await supabase
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
        Department:departmentId (
          id,
          name
        )
      `
      )
      .eq('isActive', true)
      .order('lastName', { ascending: true })

    if (fetchError) {
      console.error('Error fetching users from Supabase:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch auditors' },
        { status: 500 }
      )
    }

    const auditorRoleSet = new Set(['AUDITOR', 'QUALITY_MANAGER'])
    const auditors = (allUsers ?? []).filter((u) => {
      const roles = Array.isArray(u.roles) ? u.roles : u.role ? [u.role] : []
      return roles.some((r: string) => auditorRoleSet.has(r))
    })

    return NextResponse.json(auditors)
  } catch (error) {
    console.error('Error fetching auditors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auditors' },
      { status: 500 }
    )
  }
}
