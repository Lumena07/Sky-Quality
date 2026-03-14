import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isAdminOrQM } from '@/lib/permissions'
import { randomUUID } from 'crypto'

const requireQualityManager = async () => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase: null, userId: null }
  }
  const { roles } = await getCurrentUserProfile(supabase, user.id)
  if (!isAdminOrQM(roles)) {
    return { error: NextResponse.json({ error: 'Forbidden: Quality Manager only' }, { status: 403 }), supabase: null, userId: null }
  }
  return { error: null, supabase, userId: user.id }
}

/** GET: List monthly values for a KPI. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase } = await requireQualityManager()
  if (error) return error
  const { id } = await params
  try {
    const { data, error: e } = await supabase!
      .from('KpiMonthlyValue')
      .select('id, month, value, note, createdAt')
      .eq('kpiDefinitionId', id)
      .order('month', { ascending: false })
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to list values' }, { status: 500 })
  }
}

/** POST: Upsert monthly value (body: { month: 'YYYY-MM', value: number, note?: string }). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, supabase, userId } = await requireQualityManager()
  if (error) return error
  const { id } = await params
  try {
    const body = await request.json() as { month: string; value: number; note?: string }
    const { month, value, note } = body
    if (!month || /^\d{4}-\d{2}$/.test(month) === false || typeof value !== 'number') {
      return NextResponse.json({ error: 'month (YYYY-MM) and value required' }, { status: 400 })
    }
    const monthDate = `${month}-01`
    const { data: existing } = await supabase!
      .from('KpiMonthlyValue')
      .select('id')
      .eq('kpiDefinitionId', id)
      .eq('month', monthDate)
      .maybeSingle()
    const row = existing as { id: string } | null
    const now = new Date().toISOString()
    if (row) {
      const { data, error: e } = await supabase!
        .from('KpiMonthlyValue')
        .update({ value, note: note ?? null })
        .eq('id', row.id)
        .select()
        .single()
      if (e) return NextResponse.json({ error: e.message }, { status: 500 })
      return NextResponse.json(data)
    }
    const newId = randomUUID()
    const { data, error: e } = await supabase!
      .from('KpiMonthlyValue')
      .insert({
        id: newId,
        kpiDefinitionId: id,
        month: monthDate,
        value,
        note: note ?? null,
        createdByUserId: userId,
        createdAt: now,
      })
      .select()
      .single()
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save value' }, { status: 500 })
  }
}
