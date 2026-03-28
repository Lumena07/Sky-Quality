import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageTrainingCompliance, getCurrentUserProfile } from '@/lib/permissions'
import {
  parseRoleCodes,
  stripExcludedRolesFromComplianceAudience,
} from '@/lib/training-compliance-applicability'

const normalizeLabel = (s: string) => s.trim().slice(0, 200)

type RouteCtx = { params: Promise<{ id: string }> }

/** PATCH: update label and/or role audience for a document kind. */
export async function PATCH(request: Request, ctx: RouteCtx) {
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

    const { id } = await ctx.params
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from('CompliancePersonalDocumentKind')
      .select('*')
      .eq('id', id.trim())
      .maybeSingle()
    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const patch: Record<string, unknown> = {}

    if (typeof body.label === 'string') {
      const label = normalizeLabel(body.label)
      if (!label) {
        return NextResponse.json({ error: 'label cannot be empty' }, { status: 400 })
      }
      patch.label = label
    }

    if ('applicableRoles' in body) {
      if (body.applicableRoles === null) {
        patch.applicableRoles = null
      } else if (Array.isArray(body.applicableRoles)) {
        const roleCodes = stripExcludedRolesFromComplianceAudience(
          parseRoleCodes(body.applicableRoles)
        )
        patch.applicableRoles = roleCodes.length > 0 ? roleCodes : null
      } else {
        return NextResponse.json({ error: 'applicableRoles must be array or null' }, { status: 400 })
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('CompliancePersonalDocumentKind')
      .update(patch)
      .eq('id', id.trim())
      .select('*')
      .single()

    if (error || !data) {
      console.error('personal-document-kinds patch', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/** DELETE: remove a non-system document kind (only if no user documents use it). */
export async function DELETE(_request: Request, ctx: RouteCtx) {
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

    const { id } = await ctx.params
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from('CompliancePersonalDocumentKind')
      .select('id, code, isSystem')
      .eq('id', id.trim())
      .maybeSingle()
    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if ((row as { isSystem?: boolean }).isSystem) {
      return NextResponse.json({ error: 'Cannot delete system document types' }, { status: 403 })
    }

    const code = (row as { code: string }).code
    const { count, error: cntErr } = await supabase
      .from('UserComplianceDocument')
      .select('*', { count: 'exact', head: true })
      .eq('documentKind', code)
    if (cntErr) {
      console.error('personal-document-kinds delete count', cntErr)
      return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 })
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Remove or reassign saved documents for this type before deleting' },
        { status: 400 }
      )
    }

    const { error: delErr } = await supabase
      .from('CompliancePersonalDocumentKind')
      .delete()
      .eq('id', id.trim())
    if (delErr) {
      console.error('personal-document-kinds delete', delErr)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
