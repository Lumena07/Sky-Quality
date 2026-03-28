import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, hasReviewerRole } from '@/lib/permissions'

const loadCopy = async (
  supabase: ReturnType<typeof createSupabaseServerClient>,
  documentId: string,
  copyId: string
) => {
  const { data: copy, error } = await supabase
    .from('DocumentManualCopy')
    .select('id, documentId')
    .eq('id', copyId)
    .eq('documentId', documentId)
    .maybeSingle()
  if (error || !copy) return null
  return copy
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; copyId: string }> }
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
    const { id: documentId, copyId } = await params
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!hasReviewerRole(roles)) {
      return NextResponse.json(
        { error: 'Only reviewers can modify manual copies' },
        { status: 403 }
      )
    }
    const copy = await loadCopy(supabase, documentId, copyId)
    if (!copy) {
      return NextResponse.json({ error: 'Manual copy not found' }, { status: 404 })
    }

    const body = await request.json()
    const update: Record<string, unknown> = {}
    if (body.copyNumber !== undefined) {
      const v = typeof body.copyNumber === 'string' ? body.copyNumber.trim() : ''
      if (!v) return NextResponse.json({ error: 'copyNumber cannot be empty' }, { status: 400 })
      update.copyNumber = v
    }
    if (body.assignedToUserId !== undefined) {
      update.assignedToUserId =
        typeof body.assignedToUserId === 'string' && body.assignedToUserId.trim()
          ? body.assignedToUserId.trim()
          : null
    }
    if (body.notes !== undefined) {
      update.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('DocumentManualCopy')
      .update(update)
      .eq('id', copyId)
      .eq('documentId', documentId)
      .select('*')
      .single()

    if (error || !data) {
      console.error('manual-copies PATCH', error)
      return NextResponse.json({ error: 'Failed to update manual copy' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update manual copy' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; copyId: string }> }
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
    const { id: documentId, copyId } = await params
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!hasReviewerRole(roles)) {
      return NextResponse.json(
        { error: 'Only reviewers can delete manual copies' },
        { status: 403 }
      )
    }
    const copy = await loadCopy(supabase, documentId, copyId)
    if (!copy) {
      return NextResponse.json({ error: 'Manual copy not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('DocumentManualCopy')
      .delete()
      .eq('id', copyId)
      .eq('documentId', documentId)

    if (error) {
      console.error('manual-copies DELETE', error)
      return NextResponse.json({ error: 'Failed to delete manual copy' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete manual copy' }, { status: 500 })
  }
}
