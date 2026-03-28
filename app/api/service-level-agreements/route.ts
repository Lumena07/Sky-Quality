import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  canSeeExternalServiceProviders,
  getCurrentUserProfile,
  isQualityManager,
} from '@/lib/permissions'

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
    if (!canSeeExternalServiceProviders(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('ServiceLevelAgreement')
      .select('*')
      .order('isEvergreen', { ascending: true })
      .order('expiryDate', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('SLA GET', error)
      return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

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
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''
    const slaType = typeof body.slaType === 'string' ? body.slaType.trim() : ''
    const contractDate = typeof body.contractDate === 'string' ? body.contractDate.trim() : ''
    const isEvergreen = body.isEvergreen === true
    const expiryRaw = typeof body.expiryDate === 'string' ? body.expiryDate.trim() : ''
    if (!companyName || !slaType || !contractDate) {
      return NextResponse.json({ error: 'companyName, slaType, contractDate required' }, { status: 400 })
    }
    if (!isEvergreen && !expiryRaw) {
      return NextResponse.json({ error: 'expiryDate required unless isEvergreen is true' }, { status: 400 })
    }
    if (isEvergreen && expiryRaw) {
      return NextResponse.json({ error: 'expiryDate must be omitted when isEvergreen is true' }, { status: 400 })
    }

    const pdfFileUrl =
      typeof body.pdfFileUrl === 'string' && body.pdfFileUrl.trim() ? body.pdfFileUrl.trim() : ''
    if (!pdfFileUrl) {
      return NextResponse.json({ error: 'pdfFileUrl required (SLA PDF is mandatory)' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    const row = {
      id,
      companyName,
      slaType,
      location: typeof body.location === 'string' ? body.location.trim() || null : null,
      contractDate: contractDate.slice(0, 10),
      isEvergreen,
      expiryDate: isEvergreen ? null : expiryRaw.slice(0, 10),
      pdfFileUrl,
      createdAt: now,
      updatedAt: now,
      createdById: user.id,
    }

    const { data, error } = await supabase.from('ServiceLevelAgreement').insert(row).select('*').single()
    if (error || !data) {
      console.error('SLA POST', error)
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
