import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canViewActivityLog } from '@/lib/permissions'

/** GET: List activity log entries. Restricted to reviewers and AM/admin. */
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canViewActivityLog(roles)) {
      return NextResponse.json(
        { error: 'Only reviewers, Quality Manager, or Accountable Manager can view activity log' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const entityType = searchParams.get('entityType')
    const action = searchParams.get('action')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))

    let query = supabase
      .from('ActivityLog')
      .select(
        `
        id,
        userId,
        action,
        entityType,
        entityId,
        details,
        createdAt,
        auditId,
        findingId,
        documentId,
        User:userId(id, email, firstName, lastName)
      `
      )
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1)

    if (userId) {
      query = query.eq('userId', userId)
    }
    if (entityType) {
      query = query.eq('entityType', entityType)
    }
    if (action) {
      query = query.eq('action', action)
    }
    if (fromDate) {
      query = query.gte('createdAt', fromDate)
    }
    if (toDate) {
      query = query.lte('createdAt', toDate)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching activity log:', error)
      return NextResponse.json(
        { error: 'Failed to fetch activity log' },
        { status: 500 }
      )
    }

    return NextResponse.json(logs ?? [])
  } catch (error) {
    console.error('Error in /api/activity-log:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity log' },
      { status: 500 }
    )
  }
}
