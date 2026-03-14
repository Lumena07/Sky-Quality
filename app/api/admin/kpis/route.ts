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

/** GET: List all KPI definitions (active and inactive). */
export async function GET() {
  const { error, supabase } = await requireQualityManager()
  if (error) return error
  try {
    const { data, error: e } = await supabase!
      .from('KpiDefinition')
      .select('id, code, name, area, unit, direction, targetValue, isComputed, isActive, createdAt, updatedAt')
      .order('isComputed', { ascending: false })
      .order('name')
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to list KPIs' }, { status: 500 })
  }
}

/** POST: Create KPI definition (manual KPI). */
export async function POST(request: Request) {
  const { error, supabase, userId } = await requireQualityManager()
  if (error) return error
  try {
    const body = await request.json()
    const { name, area, unit, direction, targetValue, code } = body as {
      name: string
      area?: string
      unit: string
      direction: string
      targetValue?: number | null
      code?: string | null
    }
    if (!name || !unit || !direction) {
      return NextResponse.json({ error: 'name, unit, direction required' }, { status: 400 })
    }
    const now = new Date().toISOString()
    const id = randomUUID()
    const { data, error: e } = await supabase!
      .from('KpiDefinition')
      .insert({
        id,
        code: code || null,
        name,
        area: area || null,
        unit,
        direction,
        targetValue: targetValue != null ? targetValue : null,
        isComputed: false,
        isActive: true,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single()
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create KPI' }, { status: 500 })
  }
}
