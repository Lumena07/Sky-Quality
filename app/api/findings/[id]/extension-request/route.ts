import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile } from '@/lib/permissions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: findingId } = await params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: finding, error: findingError } = await supabase
      .from('Finding')
      .select('id, assignedToId, auditId')
      .eq('id', findingId)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const assignedToId = (finding as { assignedToId?: string }).assignedToId
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const isAssignee = assignedToId === user.id
    const isReviewer = roles.some(
      (r) => r === 'QUALITY_MANAGER' || r === 'AUDITOR'
    )
    if (!isAssignee && !isReviewer) {
      return NextResponse.json(
        { error: 'Only the assignee or a reviewer can request an extension' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { reason, requestedCapDueDate, requestedCloseOutDueDate } = body

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Reason is required' },
        { status: 400 }
      )
    }

    const requestId = randomUUID()
    const now = new Date().toISOString()
    const { data: extRequest, error: insertError } = await supabase
      .from('FindingExtensionRequest')
      .insert({
        id: requestId,
        findingId,
        requestedById: user.id,
        reason: reason.trim(),
        requestedCapDueDate: requestedCapDueDate
          ? new Date(requestedCapDueDate).toISOString().slice(0, 10)
          : null,
        requestedCloseOutDueDate: requestedCloseOutDueDate
          ? new Date(requestedCloseOutDueDate).toISOString().slice(0, 10)
          : null,
        status: 'PENDING',
      })
      .select('*')
      .single()

    if (insertError || !extRequest) {
      console.error('Error creating extension request:', insertError)
      return NextResponse.json(
        { error: 'Failed to create extension request' },
        { status: 500 }
      )
    }

    const auditId = (finding as { auditId?: string }).auditId
    if (auditId) {
      const { data: auditors } = await supabase
        .from('AuditAuditor')
        .select('userId')
        .eq('auditId', auditId)
      const reviewerIds = (auditors ?? [])
        .map((a: { userId: string }) => a.userId)
        .filter((uid) => uid !== user.id) as string[]
      for (const uid of reviewerIds) {
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: uid,
          type: 'SYSTEM_ALERT',
          title: 'Extension request submitted',
          message: `An extension has been requested for a finding. Please review.`,
          link: `/findings/${findingId}`,
          findingId,
        })
      }
    }

    return NextResponse.json(extRequest, { status: 201 })
  } catch (error) {
    console.error('Error in extension-request POST:', error)
    return NextResponse.json(
      { error: 'Failed to create extension request' },
      { status: 500 }
    )
  }
}
