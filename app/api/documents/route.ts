import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { generateDocumentNumber } from '@/lib/utils'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, isNormalUser, canSeeAmDashboard } from '@/lib/permissions'

const mergeDocsById = (
  lists: { id: string; createdAt: string }[][]
): { id: string; createdAt: string }[] => {
  const seen = new Set<string>()
  const merged: { id: string; createdAt: string }[] = []
  for (const list of lists) {
    for (const doc of list) {
      if (doc && !seen.has(doc.id)) {
        seen.add(doc.id)
        merged.push(doc)
      }
    }
  }
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return merged
}

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

    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const smsOnly = searchParams.get('smsOnly') === 'true'

    if (isNormalUser(roles) && !canSeeAmDashboard(roles)) {
      const manualHolderQuery = supabase
        .from('Document')
        .select('*, Revisions:DocumentRevision(*)')
        .filter('manualHolderIds', 'cs', JSON.stringify([user.id]))
        .order('createdAt', { ascending: false })

      const manualHolderRes = await manualHolderQuery
      let approvedRes: { data: unknown[] | null; error: unknown } = { data: [], error: null }
      if (departmentId) {
        approvedRes = await supabase
          .from('Document')
          .select('*, Revisions:DocumentRevision(*)')
          .eq('status', 'APPROVED')
          .filter('departmentIds', 'cs', JSON.stringify([departmentId]))
          .order('createdAt', { ascending: false })
      }

      const roleDocLists: { id: string; createdAt: string }[][] = []
      for (const r of roles) {
        if (!r || typeof r !== 'string') continue
        const { data, error } = await supabase
          .from('Document')
          .select('*, Revisions:DocumentRevision(*)')
          .filter('manualCustodianRoles', 'cs', JSON.stringify([r]))
          .order('createdAt', { ascending: false })
        if (!error && data?.length) {
          roleDocLists.push(data as { id: string; createdAt: string }[])
        }
      }

      if (approvedRes.error || manualHolderRes.error) {
        console.error('Error fetching documents:', approvedRes.error ?? manualHolderRes.error)
        return NextResponse.json(
          { error: 'Failed to fetch documents' },
          { status: 500 }
        )
      }

      const approved = (approvedRes.data ?? []) as { id: string; createdAt: string }[]
      const manualHolder = (manualHolderRes.data ?? []) as { id: string; createdAt: string }[]
      const merged = mergeDocsById([manualHolder, approved, ...roleDocLists])
      return NextResponse.json(merged)
    }

    let query = supabase
      .from('Document')
      .select('*, Revisions:DocumentRevision(*)')
      .order('createdAt', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (smsOnly) {
      query = query.eq('smsDocument', true)
    }

    const { data: documents, error } = await query

    if (error) {
      console.error('Error fetching documents from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    return NextResponse.json(documents ?? [])
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
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

    const { getCurrentUserRoles, canCreateFinding } = await import('@/lib/permissions')
    const roles = await getCurrentUserRoles(supabase, user.id)
    if (!canCreateFinding(roles)) {
      return NextResponse.json(
        { error: 'Only auditors or quality managers can create documents' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      departmentIds,
      version,
      fileUrl,
      fileType,
      fileSize,
      status,
      issueNumber,
      revisionNumber,
      manualHolderIds,
      manualCustodianRoles,
      smsDocument,
      initialManualCopyNumber,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!issueNumber?.trim()) {
      return NextResponse.json({ error: 'Issue number is required' }, { status: 400 })
    }
    if (!revisionNumber?.trim()) {
      return NextResponse.json({ error: 'Revision number is required' }, { status: 400 })
    }

    const custodianRoles = Array.isArray(manualCustodianRoles)
      ? manualCustodianRoles.filter((x: unknown) => typeof x === 'string' && x.trim().length > 0)
      : []
    if (custodianRoles.length === 0) {
      return NextResponse.json(
        { error: 'At least one manual custodian role is required' },
        { status: 400 }
      )
    }

    const holderIds = Array.isArray(manualHolderIds)
      ? manualHolderIds.filter((id: unknown) => typeof id === 'string')
      : []

    const allowedStatuses = ['DRAFT', 'REVIEW', 'APPROVED', 'RELEASED', 'OBSOLETE']
    const documentStatus =
      status && allowedStatuses.includes(status) ? status : 'DRAFT'

    const trimmedInitialCopy =
      typeof initialManualCopyNumber === 'string' ? initialManualCopyNumber.trim() : ''
    if (documentStatus === 'APPROVED' && !trimmedInitialCopy) {
      return NextResponse.json(
        { error: 'Manual copy number is required for approved documents' },
        { status: 400 }
      )
    }

    const documentId = randomUUID()
    const now = new Date().toISOString()

    const insertPayload: Record<string, unknown> = {
      id: documentId,
      documentNumber: generateDocumentNumber(),
      title: title.trim(),
      issueNumber: String(issueNumber).trim(),
      revisionNumber: String(revisionNumber).trim(),
      manualCustodianRoles: custodianRoles,
      manualHolderIds: holderIds,
      version: version || '1.0',
      status: documentStatus,
      fileUrl,
      fileType,
      fileSize,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
      smsDocument: Boolean(smsDocument),
    }
    if (documentStatus === 'APPROVED') {
      const ids = Array.isArray(departmentIds)
        ? departmentIds.filter((id: unknown) => typeof id === 'string')
        : []
      insertPayload.departmentIds = ids
    } else {
      insertPayload.departmentIds = []
    }

    const { data: document, error } = await supabase
      .from('Document')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error || !document) {
      console.error('Error creating document in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 }
      )
    }

    if (documentStatus === 'APPROVED') {
      const copyRowId = randomUUID()
      const { error: copyError } = await supabase.from('DocumentManualCopy').insert({
        id: copyRowId,
        documentId: document.id,
        copyNumber: trimmedInitialCopy,
        assignedToUserId: null,
        notes: null,
        createdAt: now,
        createdById: user.id,
      })
      if (copyError) {
        console.error('DocumentManualCopy insert after document create', copyError)
        await supabase.from('Document').delete().eq('id', document.id)
        return NextResponse.json(
          { error: 'Failed to register manual copy for this document' },
          { status: 500 }
        )
      }
    }

    await createActivityLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Document',
      entityId: document.id,
      details: `Created document: ${document.title}`,
      documentId: document.id,
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    )
  }
}
