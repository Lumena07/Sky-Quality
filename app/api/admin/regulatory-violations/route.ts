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

/** GET: List regulatory violations. */
export async function GET(request: Request) {
  const { error, supabase } = await requireQualityManager()
  if (error) return error
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  try {
    let q = supabase!
      .from('RegulatoryViolation')
      .select('id, title, description, severity, occurredAt, auditId, findingId, createdAt')
      .order('occurredAt', { ascending: false })
    if (from) q = q.gte('occurredAt', from)
    if (to) q = q.lte('occurredAt', to)
    const { data, error: e } = await q
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to list violations' }, { status: 500 })
  }
}

/** POST: Create regulatory violation. */
export async function POST(request: Request) {
  const { error, supabase, userId } = await requireQualityManager()
  if (error) return error
  try {
    const body = await request.json() as {
      title: string
      description?: string
      severity?: string
      occurredAt: string
      auditId?: string
      findingId?: string
    }
    const { title, description, severity, occurredAt, auditId, findingId } = body
    if (!title || !occurredAt) {
      return NextResponse.json({ error: 'title and occurredAt required' }, { status: 400 })
    }
    const id = randomUUID()
    const { data, error: e } = await supabase!
      .from('RegulatoryViolation')
      .insert({
        id,
        title,
        description: description ?? null,
        severity: severity ?? null,
        occurredAt,
        auditId: auditId ?? null,
        findingId: findingId ?? null,
        createdByUserId: userId,
      })
      .select()
      .single()
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create violation' }, { status: 500 })
  }
}
