import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isQualityManager } from '@/lib/permissions'

const SINGLETON_ID = 'singleton'

const normalizeOpt = (v: unknown): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s || null
}

const computeIdentityLocked = (row: {
  operatorLegalName?: string | null
  aocNumber?: string | null
} | null): boolean =>
  Boolean(String(row?.operatorLegalName ?? '').trim() && String(row?.aocNumber ?? '').trim())

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
    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!isQualityManager(roles)) {
      return NextResponse.json({ error: 'Quality Manager only' }, { status: 403 })
    }

    const { data, error } = await supabase.from('QmsSettings').select('*').eq('id', SINGLETON_ID).maybeSingle()
    if (error) {
      console.error('QmsSettings GET', error)
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
    }
    const row = data ?? {}
    const identityLocked = computeIdentityLocked(data)
    return NextResponse.json({ ...row, identityLocked })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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

    const { data: existing, error: loadError } = await supabase
      .from('QmsSettings')
      .select('*')
      .eq('id', SINGLETON_ID)
      .maybeSingle()
    if (loadError) {
      console.error('QmsSettings PATCH load', loadError)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    const body = await request.json()
    const identityLocked = computeIdentityLocked(existing)

    const storedName = existing?.operatorLegalName ?? null
    const storedAoc = existing?.aocNumber ?? null
    const storedFooter = existing?.reportFooterText ?? null
    const normName = String(storedName ?? '').trim()
    const normAoc = String(storedAoc ?? '').trim()

    if (identityLocked) {
      const lockedMsg =
        'Operator legal name and AOC number cannot be changed after they are set.'
      if ('operatorLegalName' in body) {
        const incoming = normalizeOpt(body.operatorLegalName)
        if (incoming !== normName) {
          return NextResponse.json({ error: lockedMsg }, { status: 409 })
        }
      }
      if ('aocNumber' in body) {
        const incoming = normalizeOpt(body.aocNumber)
        if (incoming !== normAoc) {
          return NextResponse.json({ error: lockedMsg }, { status: 409 })
        }
      }
    }

    let mergedOperator: string | null
    let mergedAoc: string | null
    let mergedFooter: string | null

    if (identityLocked) {
      mergedOperator = normName || null
      mergedAoc = normAoc || null
      mergedFooter =
        'reportFooterText' in body ? normalizeOpt(body.reportFooterText) : normalizeOpt(storedFooter)
    } else {
      mergedOperator =
        'operatorLegalName' in body ? normalizeOpt(body.operatorLegalName) : normalizeOpt(storedName)
      mergedAoc = 'aocNumber' in body ? normalizeOpt(body.aocNumber) : normalizeOpt(storedAoc)
      mergedFooter =
        'reportFooterText' in body ? normalizeOpt(body.reportFooterText) : normalizeOpt(storedFooter)
    }

    const row = {
      id: SINGLETON_ID,
      operatorLegalName: mergedOperator,
      aocNumber: mergedAoc,
      reportFooterText: mergedFooter,
      updatedAt: new Date().toISOString(),
      updatedById: user.id,
    }

    const { data, error } = await supabase.from('QmsSettings').upsert(row).select('*').single()
    if (error || !data) {
      console.error('QmsSettings PATCH', error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }
    return NextResponse.json({ ...data, identityLocked: computeIdentityLocked(data) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
