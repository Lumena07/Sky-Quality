import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canEditAudit } from '@/lib/permissions'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; attendanceId: string } }
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
    const { data: auditorRows } = await supabase
      .from('AuditAuditor')
      .select('userId')
      .eq('auditId', params.id)
    const auditorIds = (auditorRows ?? []).map((r: { userId: string }) => r.userId)
    const { data: auditeeRows } = await supabase
      .from('AuditAuditee')
      .select('userId')
      .eq('auditId', params.id)
    const auditeeIds = (auditeeRows ?? [])
      .map((r: { userId: string | null }) => r.userId)
      .filter(Boolean) as string[]
    if (!canEditAudit(roles, user.id, auditorIds, auditeeIds)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors assigned to this audit can update attendance' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, roleOrTitle } = body

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (name !== undefined) updatePayload.name = name
    if (roleOrTitle !== undefined) updatePayload.roleOrTitle = roleOrTitle

    const { data: updated, error } = await supabase
      .from('AuditMeetingAttendance')
      .update(updatePayload)
      .eq('id', params.attendanceId)
      .eq('auditId', params.id)
      .select('*, User:userId(id, firstName, lastName, email)')
      .single()

    if (error || !updated) {
      return NextResponse.json(
        { error: 'Attendance record not found or update failed' },
        { status: error?.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in attendance PATCH:', error)
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; attendanceId: string } }
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
    const { data: auditorRows } = await supabase
      .from('AuditAuditor')
      .select('userId')
      .eq('auditId', params.id)
    const auditorIds = (auditorRows ?? []).map((r: { userId: string }) => r.userId)
    const { data: auditeeRows } = await supabase
      .from('AuditAuditee')
      .select('userId')
      .eq('auditId', params.id)
    const auditeeIds = (auditeeRows ?? [])
      .map((r: { userId: string | null }) => r.userId)
      .filter(Boolean) as string[]
    if (!canEditAudit(roles, user.id, auditorIds, auditeeIds)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors assigned to this audit can remove attendance' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('AuditMeetingAttendance')
      .delete()
      .eq('id', params.attendanceId)
      .eq('auditId', params.id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete attendance record' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in attendance DELETE:', error)
    return NextResponse.json(
      { error: 'Failed to delete attendance' },
      { status: 500 }
    )
  }
}
