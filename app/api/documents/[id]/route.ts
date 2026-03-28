import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import {
  getCurrentUserProfile,
  canEditDocument,
  isNormalUser,
  canSeeAmDashboard,
  hasReviewerRole,
  isDocumentCustodian,
} from '@/lib/permissions'

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
    const docRow = document as {
      manualHolderIds?: unknown
      manualCustodianRoles?: unknown
      departmentIds?: string[]
    }
    const departmentIds = docRow.departmentIds ?? []
    const isReviewOrDraft = status === 'REVIEW' || status === 'DRAFT'
    const { roles, departmentId: userDepartmentId } = await getCurrentUserProfile(supabase, user.id)
    const isCustodian = isDocumentCustodian(user.id, roles, docRow)
    const isApprovedForMyDept =
      status === 'APPROVED' &&
      userDepartmentId &&
      Array.isArray(departmentIds) &&
      departmentIds.includes(userDepartmentId)
    const canOpen =
      isCustodian ||
      isApprovedForMyDept ||
      canEditDocument(isReviewOrDraft, isCustodian, roles) ||
      canSeeAmDashboard(roles)

    if (isNormalUser(roles) && !canSeeAmDashboard(roles) && !isApprovedForMyDept && !isCustodian) {
      return NextResponse.json(
        {
          error:
            'You can only view approved documents for your department or documents you are a manual custodian of',
        },
        { status: 403 }
      )
    }
    if (isReviewOrDraft && !canOpen) {
      return NextResponse.json(
        { error: 'Only manual custodians, or auditors/quality managers, can open this document' },
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
    const { fileUrl, fileType, fileSize, changeLog, manualCustodianRoles, manualHolderIds } = body

    const { data: existing, error: fetchError } = await supabase
      .from('Document')
      .select('id, version, status, manualHolderIds, manualCustodianRoles')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const existingRow = existing as {
      status?: string
      manualHolderIds?: unknown
      manualCustodianRoles?: unknown
      version?: string
    }
    const docStatus = existingRow.status
    const isReviewOrDraft = docStatus === 'REVIEW' || docStatus === 'DRAFT'
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const isCustodian = isDocumentCustodian(user.id, roles, existingRow)

    const metadataOnly =
      !fileUrl &&
      (manualCustodianRoles !== undefined || manualHolderIds !== undefined)

    if (metadataOnly) {
      if (!hasReviewerRole(roles)) {
        return NextResponse.json(
          { error: 'Only Quality Manager or auditors can update custodian settings.' },
          { status: 403 }
        )
      }
      const custodianRoles =
        manualCustodianRoles !== undefined
          ? Array.isArray(manualCustodianRoles)
            ? manualCustodianRoles.filter(
                (x: unknown) => typeof x === 'string' && x.trim().length > 0
              )
            : []
          : undefined
      if (custodianRoles !== undefined && custodianRoles.length === 0) {
        return NextResponse.json(
          { error: 'At least one manual custodian role is required' },
          { status: 400 }
        )
      }
      const holders =
        manualHolderIds !== undefined
          ? Array.isArray(manualHolderIds)
            ? manualHolderIds.filter((x: unknown) => typeof x === 'string')
            : []
          : undefined

      const updatePayload: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      }
      if (custodianRoles !== undefined) updatePayload.manualCustodianRoles = custodianRoles
      if (holders !== undefined) updatePayload.manualHolderIds = holders

      const { data: doc, error: updateError } = await supabase
        .from('Document')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single()

      if (updateError || !doc) {
        console.error('Error updating document custodians:', updateError)
        return NextResponse.json(
          { error: 'Failed to update document' },
          { status: 500 }
        )
      }

      await createActivityLog({
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Document',
        entityId: id,
        details: 'Manual custodian settings updated',
        documentId: id,
      })

      return NextResponse.json(doc)
    }

    if (!fileUrl || !fileType || fileSize == null) {
      return NextResponse.json(
        { error: 'fileUrl, fileType, and fileSize are required for new version' },
        { status: 400 }
      )
    }

    if (docStatus === 'APPROVED') {
      if (!hasReviewerRole(roles)) {
        return NextResponse.json(
          { error: 'Only Quality Manager or auditors can edit approved manuals.' },
          { status: 403 }
        )
      }
    } else {
      const canEdit = canEditDocument(isReviewOrDraft, isCustodian, roles)
      if (isReviewOrDraft && !canEdit) {
        return NextResponse.json(
          { error: 'Only manual custodians, or auditors/quality managers, can edit this document' },
          { status: 403 }
        )
      }
    }

    const newVersion = incrementVersion(String(existingRow.version ?? '1.0'))

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
