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
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase: null }
  }
  const { roles } = await getCurrentUserProfile(supabase, user.id)
  if (!isAdminOrQM(roles)) {
    return { error: NextResponse.json({ error: 'Forbidden: Quality Manager only' }, { status: 403 }), supabase: null }
  }
  return { error: null, supabase }
}

/** GET: List finding classifications (optionally by group). */
export async function GET(request: Request) {
  const { error, supabase } = await requireQualityManager()
  if (error) return error
  const group = request.nextUrl.searchParams.get('group')
  try {
    let q = supabase!
      .from('FindingClassification')
      .select('id, group, code, name, description, isActive, createdAt')
      .order('group')
      .order('name')
    if (group) q = q.eq('group', group)
    const { data, error: e } = await q
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to list classifications' }, { status: 500 })
  }
}

/** POST: Create finding classification. */
export async function POST(request: Request) {
  const { error, supabase } = await requireQualityManager()
  if (error) return error
  try {
    const body = await request.json() as { group: string; code: string; name: string; description?: string }
    const { group, code, name, description } = body
    if (!group || !code || !name) {
      return NextResponse.json({ error: 'group, code, name required' }, { status: 400 })
    }
    const id = randomUUID()
    const { data, error: e } = await supabase!
      .from('FindingClassification')
      .insert({
        id,
        group,
        code,
        name,
        description: description ?? null,
        isActive: true,
      })
      .select()
      .single()
    if (e) return NextResponse.json({ error: e.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create classification' }, { status: 500 })
  }
}
