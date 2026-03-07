import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(
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

    const body = await request.json().catch(() => ({}))
    const { signatureData } = body

    const { data: attendance, error: fetchError } = await supabase
      .from('AuditMeetingAttendance')
      .select('id, userId, auditId')
      .eq('id', params.attendanceId)
      .eq('auditId', params.id)
      .single()

    if (fetchError || !attendance) {
      return NextResponse.json(
        { error: 'Attendance record not found' },
        { status: 404 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('AuditMeetingAttendance')
      .update({
        signedAt: new Date().toISOString(),
        signatureData: signatureData ?? null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', params.attendanceId)
      .eq('auditId', params.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      console.error('Error signing attendance:', updateError)
      return NextResponse.json(
        { error: 'Failed to record sign-off' },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error in sign POST:', error)
    return NextResponse.json(
      { error: 'Failed to record sign-off' },
      { status: 500 }
    )
  }
}
