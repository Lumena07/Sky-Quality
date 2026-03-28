import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canAddTraining, canSeeTraining, getCurrentUserProfile } from '@/lib/permissions'

const assignmentSelect = `
  *,
  Course:courseId ( id, title ),
  User:userId ( id, firstName, lastName, email )
`

type ExistingAssignment = {
  id: string
  completedAt: string | null
  scheduledDate: string | null
  location: string | null
  createdAt: string
  createdById: string
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const parseScheduledDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value.trim())) return null
  const d = new Date(`${value.trim()}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return value.trim()
}

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
      .from('AuditorTrainingAssignment')
      .select(assignmentSelect)
      .order('createdAt', { ascending: false })
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
    const body = (await request.json()) as {
      courseId?: string
      userId?: string
      userIds?: unknown
      completedAt?: string | null
      scheduledDate?: string
      location?: string
    }
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : ''
    if (!courseId) {
      return NextResponse.json({ error: 'courseId required' }, { status: 400 })
    }

    const scheduledDateParsed = parseScheduledDate(body.scheduledDate)
    const locationTrimmed = typeof body.location === 'string' ? body.location.trim() : ''
    if (!scheduledDateParsed) {
      return NextResponse.json({ error: 'scheduledDate is required (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!locationTrimmed) {
      return NextResponse.json({ error: 'location is required' }, { status: 400 })
    }

    const rawIds: string[] = []
    if (Array.isArray(body.userIds)) {
      for (const id of body.userIds) {
        if (typeof id === 'string' && id.trim()) rawIds.push(id.trim())
      }
    } else if (typeof body.userId === 'string' && body.userId.trim()) {
      rawIds.push(body.userId.trim())
    }
    const userIds = rawIds.filter((id, index) => rawIds.indexOf(id) === index)
    if (userIds.length === 0) {
      return NextResponse.json({ error: 'userId or non-empty userIds required' }, { status: 400 })
    }

    const hasCompletedAtKey = Object.prototype.hasOwnProperty.call(body, 'completedAt')
    const completedAtExplicit = hasCompletedAtKey
      ? body.completedAt && typeof body.completedAt === 'string'
        ? new Date(body.completedAt).toISOString()
        : null
      : undefined

    const now = new Date().toISOString()
    const saved: unknown[] = []

    for (const uid of userIds) {
      const { data: existingRow } = await supabase
        .from('AuditorTrainingAssignment')
        .select('id, completedAt, scheduledDate, location, createdAt, createdById')
        .eq('courseId', courseId)
        .eq('userId', uid)
        .maybeSingle()

      const existing = existingRow as ExistingAssignment | null
      const rowId = existing?.id ?? randomUUID()
      const completedAt =
        completedAtExplicit !== undefined ? completedAtExplicit : (existing?.completedAt ?? null)

      const { data, error } = await supabase
        .from('AuditorTrainingAssignment')
        .upsert(
          {
            id: rowId,
            courseId,
            userId: uid,
            completedAt,
            scheduledDate: scheduledDateParsed,
            location: locationTrimmed,
            createdAt: existing?.createdAt ?? now,
            createdById: existing?.createdById ?? user.id,
          },
          { onConflict: 'courseId,userId' }
        )
        .select(assignmentSelect)
        .single()

      if (error || !data) {
        console.error('assignment upsert', error)
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
      }
      saved.push(data)
    }

    if (userIds.length === 1) {
      return NextResponse.json(saved[0], { status: 201 })
    }
    return NextResponse.json({ assignments: saved }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
