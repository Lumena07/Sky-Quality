import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  canSeeRegulatoryLibrary,
  getCurrentUserProfile,
  isQualityManager,
} from '@/lib/permissions'

const KIND_TGM = 'TGM'
const KIND_AC = 'AC'

/** GET: list documents (kind filter + search). Quality module users. */
export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeRegulatoryLibrary(roles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind')
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()

    let query = supabase
      .from('RegulatoryLibraryDocument')
      .select(
        `
        *,
        UploadedBy:uploadedById ( id, firstName, lastName, email )
      `
      )
      .order('uploadedAt', { ascending: false })

    if (kind === KIND_TGM || kind === KIND_AC) {
      query = query.eq('kind', kind)
    }

    const { data, error } = await query
    if (error) {
      console.error('regulatory-library GET', error)
      return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
    }

    let rows = data ?? []
    if (q) {
      rows = rows.filter((row: Record<string, unknown>) => {
        const title = String(row.title ?? '').toLowerCase()
        const cat = String(row.category ?? '').toLowerCase()
        const ver = String(row.version ?? '').toLowerCase()
        const acn = String(row.acNumber ?? '').toLowerCase()
        const sub = String(row.subject ?? '').toLowerCase()
        return title.includes(q) || cat.includes(q) || ver.includes(q) || acn.includes(q) || sub.includes(q)
      })
    }

    return NextResponse.json(rows)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }
}

/** POST: register PDF after upload. QM only. */
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
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!isQualityManager(roles)) {
      return NextResponse.json({ error: 'Quality Manager only' }, { status: 403 })
    }

    const body = await request.json()
    const kind = body.kind === KIND_AC ? KIND_AC : KIND_TGM
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : ''
    const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : 'application/pdf'
    const fileSize = typeof body.fileSize === 'number' ? body.fileSize : parseInt(String(body.fileSize), 10)
    if (!title || !fileUrl || Number.isNaN(fileSize)) {
      return NextResponse.json({ error: 'title, fileUrl, fileSize required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    const row = {
      id,
      kind,
      title,
      category: typeof body.category === 'string' ? body.category.trim() || null : null,
      version: typeof body.version === 'string' ? body.version.trim() || null : null,
      acNumber: kind === KIND_AC && typeof body.acNumber === 'string' ? body.acNumber.trim() || null : null,
      subject: kind === KIND_AC && typeof body.subject === 'string' ? body.subject.trim() || null : null,
      fileUrl,
      fileType,
      fileSize,
      uploadedAt: now,
      uploadedById: user.id,
    }

    const { data, error } = await supabase.from('RegulatoryLibraryDocument').insert(row).select('*').single()
    if (error || !data) {
      console.error('regulatory-library POST', error)
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
