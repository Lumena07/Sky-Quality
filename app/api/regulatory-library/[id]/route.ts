import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  canSeeRegulatoryLibrary,
  getCurrentUserProfile,
  isQualityManager,
} from '@/lib/permissions'

export async function GET(
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
    if (!canSeeRegulatoryLibrary(roles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const { data, error } = await supabase.from('RegulatoryLibraryDocument').select('*').eq('id', id).maybeSingle()
    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
    const { error } = await supabase.from('RegulatoryLibraryDocument').delete().eq('id', id)
    if (error) {
      console.error('regulatory-library DELETE', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
