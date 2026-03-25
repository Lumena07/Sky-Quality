import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

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
      .select('id, assignedToId, closeOutDueDate')
      .eq('id', findingId)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const assignedToId = (finding as { assignedToId?: string }).assignedToId
    const isAssignee = assignedToId === user.id
    if (!isAssignee) {
      return NextResponse.json(
        { error: 'Only the assignee can request an extension' },
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

    const capDate =
      requestedCapDueDate != null && String(requestedCapDueDate).trim() !== ''
        ? new Date(requestedCapDueDate).toISOString().slice(0, 10)
        : null
    const closeOutDate =
      requestedCloseOutDueDate != null && String(requestedCloseOutDueDate).trim() !== ''
        ? new Date(requestedCloseOutDueDate).toISOString().slice(0, 10)
        : null

    if (!capDate && !closeOutDate) {
      return NextResponse.json(
        { error: 'Request at least a CAP due date or a close-out (CAT) due date' },
        { status: 400 }
      )
    }
    if (capDate) {
      return NextResponse.json(
        {
          error:
            'CAP due-date changes are not handled through extension requests. Use CAP entry / review flows instead.',
        },
        { status: 400 }
      )
    }
    if (!closeOutDate) {
      return NextResponse.json(
        { error: 'Extension request must include a close-out (CAT) due date' },
        { status: 400 }
      )
    }

    const currentCloseOutDueDate = (finding as { closeOutDueDate?: string | null }).closeOutDueDate
    if (!currentCloseOutDueDate) {
      return NextResponse.json(
        { error: 'No current CAT due date exists for this finding to extend' },
        { status: 400 }
      )
    }
    const now = new Date()
    const currentDue = new Date(currentCloseOutDueDate)
    const msUntilDue = currentDue.getTime() - now.getTime()
    const daysUntilDue = msUntilDue / (24 * 60 * 60 * 1000)
    if (daysUntilDue > 14) {
      return NextResponse.json(
        {
          error:
            'CAT extension request is only allowed when the current due date is close (14 days or less). If you already know at CAP entry, use Longer CAT due date proposal.',
        },
        { status: 400 }
      )
    }

    const involvesCatExtension = Boolean(closeOutDate)

    const requestId = randomUUID()
    const { data: extRequest, error: insertError } = await supabase
      .from('FindingExtensionRequest')
      .insert({
        id: requestId,
        findingId,
        requestedById: user.id,
        reason: reason.trim(),
        requestedCapDueDate: capDate,
        requestedCloseOutDueDate: closeOutDate,
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

    const notifyUserIds = new Set<string>()

    if (involvesCatExtension) {
      const { data: qmRows } = await supabase
        .from('User')
        .select('id')
        .eq('isActive', true)
        .contains('roles', ['QUALITY_MANAGER'])
      for (const row of qmRows ?? []) {
        const uid = (row as { id: string }).id
        if (uid && uid !== user.id) notifyUserIds.add(uid)
      }
    }

    const title = involvesCatExtension
      ? 'CAT / close-out extension request'
      : 'CAP extension request'
    const message = involvesCatExtension
      ? 'A Quality Manager must review a close-out (CAT) due date extension for a finding.'
      : 'An extension has been requested for a finding CAP due date. Please review.'

    for (const uid of Array.from(notifyUserIds)) {
      await supabase.from('Notification').insert({
        id: randomUUID(),
        userId: uid,
        type: 'SYSTEM_ALERT',
        title,
        message,
        link: `/findings/${findingId}`,
        findingId,
      })
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
