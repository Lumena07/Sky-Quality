import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, canEditDocument, isNormalUser, canSeeAmDashboard, hasReviewerRole } from '@/lib/permissions'

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

    const { id } = await params

    const { data: document, error } = await supabase
      .from('Document')
      .select(
        `
        *,
        Revisions:DocumentRevision(*)
      `
      )
      .eq('id', id)
      .single()

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const status = document.status as string
    const manualHolderIds = (document as { manualHolderIds?: string[] }).manualHolderIds ?? []
    const departmentIds = (document as { departmentIds?: string[] }).departmentIds ?? []
    const isReviewOrDraft = status === 'REVIEW' || status === 'DRAFT'
    const isManualHolder =
      Array.isArray(manualHolderIds) && manualHolderIds.includes(user.id)
    const { roles, departmentId: userDepartmentId } = await getCurrentUserProfile(supabase, user.id)
    const isApprovedForMyDept =
      status === 'APPROVED' &&
      userDepartmentId &&
      Array.isArray(departmentIds) &&
      departmentIds.includes(userDepartmentId)
    const canOpen =
      isManualHolder ||
      isApprovedForMyDept ||
      canEditDocument(isReviewOrDraft, isManualHolder, roles) ||
      canSeeAmDashboard(roles)

    if (isNormalUser(roles) && !canSeeAmDashboard(roles) && !isApprovedForMyDept && !isManualHolder) {
      return NextResponse.json(
        { error: 'You can only view approved documents for your department or documents you are a manual holder of' },
        { status: 403 }
      )
    }
    if (isReviewOrDraft && !canOpen) {
      return NextResponse.json(
        { error: 'Only manual holders, or auditors/quality managers, can open this document' },
        { status: 403 }
      )
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

const incrementVersion = (currentVersion: string): string => {
  const parts = String(currentVersion || '1.0').split('.')
  const major = parseInt(parts[0], 10) || 1
  const minor = parseInt(parts[1], 10) || 0
  return `${major}.${minor + 1}`
}

export async function PATCH(
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

    const { id } = await params
    const body = await request.json()
    const { fileUrl, fileType, fileSize, changeLog } = body

    if (!fileUrl || !fileType || fileSize == null) {
      return NextResponse.json(
        { error: 'fileUrl, fileType, and fileSize are required for new version' },
        { status: 400 }
      )
    }

    const { data: existing, error: fetchError } = await supabase
      .from('Document')
      .select('id, version, status, manualHolderIds')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const docStatus = (existing as { status?: string }).status
    const manualHolderIds = (existing as { manualHolderIds?: string[] }).manualHolderIds ?? []
    const isReviewOrDraft = docStatus === 'REVIEW' || docStatus === 'DRAFT'
    const isManualHolder =
      Array.isArray(manualHolderIds) && manualHolderIds.includes(user.id)
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (docStatus === 'APPROVED') {
      if (!hasReviewerRole(roles)) {
        return NextResponse.json(
          { error: 'Only Quality Manager or auditors can edit approved manuals.' },
          { status: 403 }
        )
      }
    } else {
      const canEdit = canEditDocument(isReviewOrDraft, isManualHolder, roles)
      if (isReviewOrDraft && !canEdit) {
        return NextResponse.json(
          { error: 'Only manual holders, or auditors/quality managers, can edit this document' },
          { status: 403 }
        )
      }
    }

    const newVersion = incrementVersion(existing.version)

    const { data: doc, error: updateError } = await supabase
      .from('Document')
      .update({
        fileUrl,
        fileType,
        fileSize: parseInt(String(fileSize), 10),
        version: newVersion,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError || !doc) {
      console.error('Error updating document:', updateError)
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }

    const { error: revError } = await supabase.from('DocumentRevision').insert({
      id: randomUUID(),
      documentId: id,
      version: newVersion,
      changeLog: changeLog || `New version ${newVersion} uploaded`,
      fileUrl,
      createdById: user.id,
    })

    if (revError) {
      console.error('Error creating document revision record:', revError)
    }

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Document',
      entityId: id,
      details: `Document version updated to ${newVersion}`,
      documentId: id,
    })

    return NextResponse.json(doc)
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    )
  }
}
