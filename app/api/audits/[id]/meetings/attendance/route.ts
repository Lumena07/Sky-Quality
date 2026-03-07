import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile } from '@/lib/permissions'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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

    const { searchParams } = new URL(request.url)
    const meetingType = searchParams.get('meetingType') as 'OPENING' | 'CLOSING' | null

    if (!meetingType || !['OPENING', 'CLOSING'].includes(meetingType)) {
      return NextResponse.json(
        { error: 'meetingType query param must be OPENING or CLOSING' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('AuditMeetingAttendance')
      .select('*, User:userId(id, firstName, lastName, email)')
      .eq('auditId', params.id)
      .eq('meetingType', meetingType)
      .order('createdAt', { ascending: true })

    const { data: rows, error } = await query

    if (error) {
      console.error('Error fetching meeting attendance:', error)
      return NextResponse.json(
        { error: 'Failed to fetch attendance' },
        { status: 500 }
      )
    }

    return NextResponse.json(rows ?? [])
  } catch (error) {
    console.error('Error in meetings attendance GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const auditorIds = await (async () => {
      const { data } = await supabase
        .from('AuditAuditor')
        .select('userId')
        .eq('auditId', params.id)
      return (data ?? []).map((r: { userId: string }) => r.userId)
    })()
    const canManage =
      roles.some((r) => r === 'SYSTEM_ADMIN' || r === 'QUALITY_MANAGER') ||
      auditorIds.includes(user.id)

    if (!canManage) {
      return NextResponse.json(
        { error: 'Only auditors or QM/Admin can manage meeting attendance' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { meetingType, userId, name, roleOrTitle } = body

    if (!meetingType || !['OPENING', 'CLOSING'].includes(meetingType)) {
      return NextResponse.json(
        { error: 'meetingType must be OPENING or CLOSING' },
        { status: 400 }
      )
    }

    const id = randomUUID()
    const now = new Date().toISOString()
    const { data: row, error } = await supabase
      .from('AuditMeetingAttendance')
      .insert({
        id,
        auditId: params.id,
        meetingType,
        userId: userId || null,
        name: name ?? null,
        roleOrTitle: roleOrTitle ?? null,
        updatedAt: now,
      })
      .select('*, User:userId(id, firstName, lastName, email)')
      .single()

    if (error || !row) {
      console.error('Error creating meeting attendance:', error)
      return NextResponse.json(
        { error: 'Failed to add attendance' },
        { status: 500 }
      )
    }

    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('Error in meetings attendance POST:', error)
    return NextResponse.json(
      { error: 'Failed to add attendance' },
      { status: 500 }
    )
  }
}
