import { NextResponse } from 'next/server'
import { canManageSmsRegulatory, canViewSmsRegulatory } from '@/lib/sms-permissions'
import { getSmsAuthContext } from '@/lib/sms'

export async function GET() {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canViewSmsRegulatory(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let q = supabase
    .from('sms_regulatory_authorities')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (profile.organizationId) {
    q = q.or(`organization_id.eq.${profile.organizationId},organization_id.is.null`)
  }
  const { data, error } = await q
  if (error) return NextResponse.json({ error: 'Failed to load authorities' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsRegulatory(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const name = String(body.name || '').trim()
  const code = String(body.code || '').trim()
  if (!name || !code) return NextResponse.json({ error: 'Name and code required' }, { status: 400 })

  const { data, error } = await supabase
    .from('sms_regulatory_authorities')
    .insert({
      organization_id: body.organizationId ?? profile.organizationId ?? null,
      name,
      code,
      is_active: body.isActive !== false,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create authority' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
