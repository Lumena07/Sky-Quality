import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, hasReviewerRole, isDocumentCustodian, canSeeAmDashboard } from '@/lib/permissions'

const canViewDocumentForManualCopies = async (
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  documentId: string,
  roles: string[],
  departmentId: string | null
): Promise<boolean> => {
  const { data: document, error } = await supabase
    .from('Document')
    .select('id, status, manualHolderIds, manualCustodianRoles, departmentIds')
    .eq('id', documentId)
    .single()
  if (error || !document) return false
  const d = document as {
    status: string
    manualHolderIds?: unknown
    manualCustodianRoles?: unknown
    departmentIds?: string[]
  }
  if (hasReviewerRole(roles) || canSeeAmDashboard(roles)) return true
  const deptIds = d.departmentIds ?? []
  const approvedDept =
    d.status === 'APPROVED' &&
    departmentId &&
    Array.isArray(deptIds) &&
    deptIds.includes(departmentId)
  if (approvedDept) return true
  return isDocumentCustodian(userId, roles, d)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const { id: documentId } = await params
    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    const allowed = await canViewDocumentForManualCopies(
      supabase,
      user.id,
      documentId,
      roles,
      departmentId
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('DocumentManualCopy')
      .select('*')
      .eq('documentId', documentId)
      .order('createdAt', { ascending: false })

    if (error) {
      console.error('manual-copies GET', error)
      return NextResponse.json({ error: 'Failed to list manual copies' }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to list manual copies' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!hasReviewerRole(roles)) {
      return NextResponse.json({ error: 'Only reviewers can create manual copies' }, { status: 403 })
    }
    const { id: documentId } = await params
    const allowed = await canViewDocumentForManualCopies(
      supabase,
      user.id,
      documentId,
      roles,
      departmentId
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const copyNumber = typeof body.copyNumber === 'string' ? body.copyNumber.trim() : ''
    if (!copyNumber) {
      return NextResponse.json({ error: 'copyNumber is required' }, { status: 400 })
    }
    const assignedToUserId =
      typeof body.assignedToUserId === 'string' && body.assignedToUserId.trim()
        ? body.assignedToUserId.trim()
        : null
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    const now = new Date().toISOString()
    const rowId = randomUUID()

    const { data, error } = await supabase
      .from('DocumentManualCopy')
      .insert({
        id: rowId,
        documentId,
        copyNumber,
        assignedToUserId,
        notes,
        createdAt: now,
        createdById: user.id,
      })
      .select('*')
      .single()

    if (error) {
      console.error('manual-copies POST', error)
      return NextResponse.json({ error: 'Failed to create manual copy' }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create manual copy' }, { status: 500 })
  }
}
