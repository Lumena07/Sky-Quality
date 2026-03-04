import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

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

    let query = supabase
      .from('Department')
      .select('*')
      .order('name', { ascending: true })
    if (!includeInactive) {
      query = query.eq('isActive', true)
    }
    const { data: departments, error } = await query

    if (error) {
      console.error('Error fetching departments from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch departments' },
        { status: 500 }
      )
    }

    return NextResponse.json(departments ?? [])
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
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
    const { name, code, description } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      )
    }
    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { error: 'Department code is required' },
        { status: 400 }
      )
    }

    const { data: department, error } = await supabase
      .from('Department')
      .insert({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A department with this name or code already exists' },
          { status: 409 }
        )
      }
      console.error('Error creating department in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to create department' },
        { status: 500 }
      )
    }

    return NextResponse.json(department, { status: 201 })
  } catch (error) {
    console.error('Error creating department:', error)
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    )
  }
}
