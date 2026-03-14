import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isAdminOrQM } from '@/lib/permissions'

const requireQualityManager = async () => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase: null }
  }
  const { roles } = await getCurrentUserProfile(supabase, user.id)
  if (!isAdminOrQM(roles)) {
    return { error: NextResponse.json({ error: 'Forbidden: Quality Manager only' }, { status: 403 }), supabase: null }
  }
  return { error: null, supabase }
}

/** PATCH: Update KPI definition (targetValue, isActive only; name/area/unit/direction are read-only). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await requireQualityManager()
  if (error) return error
  const { id } = await params
  try {
    const body = await request.json() as Record<string, unknown>
    const allowed = ['targetValue', 'isActive']
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    for (const k of allowed) {
      if (body[k] !== undefined) updates[k] = body[k]
    }
    const { data, error: e } = await supabase!
      .from('KpiDefinition')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update KPI' }, { status: 500 })
  }
}

/** DELETE: Deactivate KPI (soft: set isActive false). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await requireQualityManager()
  if (error) return error
  const { id } = await params
  try {
    const { error: e } = await supabase!
      .from('KpiDefinition')
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq('id', id)
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to deactivate KPI' }, { status: 500 })
  }
}
