import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, normalizeAppUserRoles } from '@/lib/permissions'

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

    const body = await request.json()
    const { name, fileUrl, fileType, fileSize, documentKind: rawKind } = body
    const documentKind = rawKind === 'FOCAL_PRE_AUDIT' ? 'FOCAL_PRE_AUDIT' : 'GENERAL'

    const { data: auditRow, error: auditErr } = await supabase
      .from('Audit')
      .select('id, type, status')
      .eq('id', params.id)
      .single()
    if (auditErr || !auditRow) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const auditType = (auditRow as { type: string }).type
    const auditStatus = (auditRow as { status: string }).status

    const { roles: profileRoles } = await getCurrentUserProfile(supabase, user.id)
    const roles = normalizeAppUserRoles(profileRoles)

    if (documentKind === 'FOCAL_PRE_AUDIT') {
      if (auditType !== 'EXTERNAL' && auditType !== 'THIRD_PARTY') {
        return NextResponse.json(
          { error: 'Pre-audit focal documentation is only for external or third-party audits' },
          { status: 400 }
        )
      }
      if (auditStatus === 'CLOSED') {
        return NextResponse.json({ error: 'This audit is closed; uploads are not allowed' }, { status: 400 })
      }
      if (!roles.includes('FOCAL_PERSON')) {
        return NextResponse.json(
          { error: 'Only a focal person can upload this type of document' },
          { status: 403 }
        )
      }
      const { data: auditeeLink } = await supabase
        .from('AuditAuditee')
        .select('id')
        .eq('auditId', params.id)
        .eq('userId', user.id)
        .maybeSingle()
      if (!auditeeLink) {
        return NextResponse.json(
          { error: 'You must be listed as an auditee on this audit to upload pre-audit documentation' },
          { status: 403 }
        )
      }
    } else {
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
      const onTeam = auditorIds.includes(user.id) || auditeeIds.includes(user.id)
      const allowGeneral = roles.includes('QUALITY_MANAGER') || onTeam
      if (!allowGeneral) {
        return NextResponse.json(
          { error: 'You do not have permission to upload documents for this audit' },
          { status: 403 }
        )
      }
    }

    const { data: document, error } = await supabase
      .from('AuditDocument')
      .insert({
        auditId: params.id,
        name,
        fileUrl,
        fileType,
        fileSize,
        uploadedBy: user.id,
        documentKind,
      })
      .select('*')
      .single()

    if (error || !document) {
      console.error('Error creating audit document in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 }
      )
    }

    await createActivityLog({
      userId: user.id,
      action: 'UPLOAD',
      entityType: 'AuditDocument',
      entityId: document.id,
      details: `Uploaded document: ${name}`,
      auditId: params.id,
      documentId: document.id,
    })

    if (documentKind === 'FOCAL_PRE_AUDIT') {
      const { data: auditors } = await supabase
        .from('AuditAuditor')
        .select('userId')
        .eq('auditId', params.id)
      for (const row of auditors ?? []) {
        const uid = (row as { userId: string }).userId
        if (!uid || uid === user.id) continue
        await supabase.from('Notification').insert({
          id: randomUUID(),
          userId: uid,
          type: 'SYSTEM_ALERT',
          title: 'Pre-audit documentation uploaded',
          message: `A focal person uploaded documentation for audit documents. Review it on the audit overview.`,
          link: `/audits/${params.id}`,
          auditId: params.id,
        })
      }
    }

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error creating audit document:', error)
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    )
  }
}
