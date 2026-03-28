import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canAccessTrainingCompliancePage, getCurrentUserProfile } from '@/lib/permissions'
import { ensureComplianceTrainingCompletionRows } from '@/lib/training-compliance-ensure'
import { userExcludedFromCompanyTrainingCompliance } from '@/lib/training-compliance-applicability'

/** GET: users, training types, completions, personal documents for compliance matrix. */
export async function GET() {
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
    if (!canAccessTrainingCompliancePage(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureComplianceTrainingCompletionRows(supabase)

    const { data: types, error: tErr } = await supabase
      .from('ComplianceTrainingType')
      .select('*')
      .order('name', { ascending: true })
    if (tErr) {
      console.error('matrix types', tErr)
      return NextResponse.json({ error: 'Failed to load types' }, { status: 500 })
    }

    const { data: users, error: uErr } = await supabase
      .from('User')
      .select(
        `
        id,
        email,
        firstName,
        lastName,
        roles,
        role,
        departmentId,
        roleMetadata,
        Department:departmentId ( id, name )
      `
      )
      .eq('isActive', true)
      .order('lastName', { ascending: true })
    if (uErr) {
      console.error('matrix users', uErr)
      return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
    }

    const companyUsers = (users ?? []).filter(
      (u) => !userExcludedFromCompanyTrainingCompliance(u)
    )
    const companyUserIds = new Set(companyUsers.map((u) => u.id))

    const { data: completions, error: cErr } = await supabase
      .from('ComplianceTrainingCompletion')
      .select('*')
    if (cErr) {
      console.error('matrix completions', cErr)
      return NextResponse.json({ error: 'Failed to load completions' }, { status: 500 })
    }

    const { data: userDocs, error: dErr } = await supabase.from('UserComplianceDocument').select('*')
    if (dErr) {
      console.error('matrix userDocs', dErr)
      return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 })
    }

    const { data: kindRows, error: kErr } = await supabase
      .from('CompliancePersonalDocumentKind')
      .select('*')
      .order('sortOrder', { ascending: true })
      .order('label', { ascending: true })
    if (kErr) {
      console.error('matrix personal doc kinds', kErr)
      return NextResponse.json({ error: 'Failed to load document kinds' }, { status: 500 })
    }

    const kinds = [...(kindRows ?? [])] as Array<{
      id: string
      code: string
      label: string
      applicableRoles: unknown
      sortOrder: number
      isSystem: boolean
      createdAt: string
    }>
    const knownCodes = new Set(kinds.map((k) => k.code))
    for (const doc of userDocs ?? []) {
      const code = typeof doc.documentKind === 'string' ? doc.documentKind : ''
      if (code && !knownCodes.has(code)) {
        knownCodes.add(code)
        kinds.push({
          id: `orphan_${code}`,
          code,
          label: code,
          applicableRoles: null,
          sortOrder: 99999,
          isSystem: false,
          createdAt: new Date().toISOString(),
        })
      }
    }
    kinds.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))

    const completionsFiltered = (completions ?? []).filter((c) =>
      companyUserIds.has((c as { userId: string }).userId)
    )
    const userDocsFiltered = (userDocs ?? []).filter((d) =>
      companyUserIds.has((d as { userId: string }).userId)
    )

    return NextResponse.json({
      trainingTypes: types ?? [],
      users: companyUsers,
      completions: completionsFiltered,
      userDocuments: userDocsFiltered,
      personalDocumentKinds: kinds,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
