import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserRoles, isQualityManager } from '@/lib/permissions'

const SOURCE_MANUAL = 'MANUAL'

/** GET: list TCAA mandatory notifications (Quality Manager only). */
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

    const roles = await getCurrentUserRoles(supabase, user.id)
    if (!isQualityManager(roles)) {
      return NextResponse.json({ error: 'Only Quality Manager can view TCAA notifications' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('TcaaMandatoryNotification')
      .select(
        `
        *,
        Finding:findingId(id, findingNumber, status, priority, description, closeOutDueDate),
        CreatedBy:createdById(id, firstName, lastName, email)
      `
      )
      .order('createdAt', { ascending: false })
      .limit(200)

    if (error) {
      console.error('TcaaMandatoryNotification GET', error)
      return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('tcaa-mandatory-notifications GET', e)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }
}

/** POST: add manual TCAA notification for a finding (Quality Manager only). */
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

    const roles = await getCurrentUserRoles(supabase, user.id)
    if (!isQualityManager(roles)) {
      return NextResponse.json({ error: 'Only Quality Manager can add TCAA notifications' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const findingId = typeof body.findingId === 'string' ? body.findingId.trim() : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null

    if (!findingId) {
      return NextResponse.json({ error: 'findingId is required' }, { status: 400 })
    }

    const { data: finding, error: fErr } = await supabase
      .from('Finding')
      .select('id')
      .eq('id', findingId)
      .single()

    if (fErr || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { data: row, error: insErr } = await supabase
      .from('TcaaMandatoryNotification')
      .insert({
        id: randomUUID(),
        findingId,
        source: SOURCE_MANUAL,
        notes: notes || null,
        createdAt: now,
        createdById: user.id,
        resolvedAt: null,
      })
      .select(
        `
        *,
        Finding:findingId(id, findingNumber, status, priority),
        CreatedBy:createdById(id, firstName, lastName, email)
      `
      )
      .single()

    if (insErr || !row) {
      console.error('TcaaMandatoryNotification POST', insErr)
      return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
    }

    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('tcaa-mandatory-notifications POST', e)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
