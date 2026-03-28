import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageTrainingCompliance, getCurrentUserProfile } from '@/lib/permissions'
import {
  parseRoleCodes,
  stripExcludedRolesFromComplianceAudience,
} from '@/lib/training-compliance-applicability'

const normalizeLabel = (s: string) => s.trim().slice(0, 200)

/** GET: list personal document kinds (catalog). */
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
    if (!canManageTrainingCompliance(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('CompliancePersonalDocumentKind')
      .select('*')
      .order('sortOrder', { ascending: true })
      .order('label', { ascending: true })
    if (error) {
      console.error('personal-document-kinds list', error)
      return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/** POST: create a custom document type (optional role restriction). */
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
    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canManageTrainingCompliance(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const label = typeof body.label === 'string' ? normalizeLabel(body.label) : ''
    if (!label) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 })
    }

    const roleCodes = stripExcludedRolesFromComplianceAudience(
      Array.isArray(body.applicableRoles) ? parseRoleCodes(body.applicableRoles) : []
    )
    const applicableRoles = roleCodes.length > 0 ? roleCodes : null

    const code = `CUSTOM_${randomUUID().replace(/-/g, '').toUpperCase()}`

    const { data: maxRow } = await supabase
      .from('CompliancePersonalDocumentKind')
      .select('sortOrder')
      .order('sortOrder', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextSort = ((maxRow as { sortOrder?: number } | null)?.sortOrder ?? 0) + 10

    const id = randomUUID()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('CompliancePersonalDocumentKind')
      .insert({
        id,
        code,
        label,
        applicableRoles,
        sortOrder: nextSort,
        isSystem: false,
        createdAt: now,
      })
      .select('*')
      .single()

    if (error || !data) {
      console.error('personal-document-kinds insert', error)
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
