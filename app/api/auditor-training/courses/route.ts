import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canAddTraining, canSeeTraining, getCurrentUserProfile } from '@/lib/permissions'

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
    if (!canSeeTraining(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { data, error } = await supabase
      .from('AuditorTrainingCourse')
      .select('*')
      .order('sortOrder', { ascending: true })
      .order('title', { ascending: true })
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
    if (!canSeeTraining(roles, departmentId) || !canAddTraining(roles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }
    const now = new Date().toISOString()
    const row = {
      id: randomUUID(),
      title,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      createdAt: now,
    }
    const { data, error } = await supabase.from('AuditorTrainingCourse').insert(row).select('*').single()
    if (error || !data) {
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
