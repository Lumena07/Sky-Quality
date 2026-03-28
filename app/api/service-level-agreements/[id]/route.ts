import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isQualityManager } from '@/lib/permissions'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const body = await request.json()
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (body.companyName !== undefined) update.companyName = String(body.companyName).trim()
    if (body.slaType !== undefined) update.slaType = String(body.slaType).trim()
    if (body.location !== undefined) update.location = body.location ? String(body.location).trim() : null
    if (body.contractDate !== undefined) update.contractDate = String(body.contractDate).slice(0, 10)
    if (body.pdfFileUrl !== undefined) {
      const trimmed = body.pdfFileUrl && String(body.pdfFileUrl).trim() ? String(body.pdfFileUrl).trim() : ''
      if (!trimmed) {
        return NextResponse.json(
          { error: 'pdfFileUrl cannot be empty; SLA PDF is mandatory' },
          { status: 400 }
        )
      }
      update.pdfFileUrl = trimmed
    }

    const evergreenTouched = body.isEvergreen !== undefined
    const expiryTouched = body.expiryDate !== undefined
    if (evergreenTouched && body.isEvergreen === true) {
      update.isEvergreen = true
      update.expiryDate = null
    } else if (evergreenTouched && body.isEvergreen === false) {
      if (!expiryTouched || !body.expiryDate) {
        return NextResponse.json(
          { error: 'expiryDate required when setting isEvergreen to false' },
          { status: 400 }
        )
      }
      update.isEvergreen = false
      update.expiryDate = String(body.expiryDate).slice(0, 10)
    } else if (expiryTouched) {
      const exp = body.expiryDate ? String(body.expiryDate).slice(0, 10) : null
      if (!exp) {
        return NextResponse.json({ error: 'expiryDate cannot be cleared without isEvergreen true' }, { status: 400 })
      }
      update.expiryDate = exp
      update.isEvergreen = false
    }

    const { data, error } = await supabase
      .from('ServiceLevelAgreement')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !data) {
      console.error('SLA PATCH', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    await supabase.from('SlaExpiryNotificationSent').delete().eq('slaId', id)
    const { error } = await supabase.from('ServiceLevelAgreement').delete().eq('id', id)
    if (error) {
      console.error('SLA DELETE', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
