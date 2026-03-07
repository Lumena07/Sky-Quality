import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: findingId } = await params
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from('FindingExtensionRequest')
      .select('*, RequestedBy:requestedById(id, firstName, lastName, email), ReviewedBy:reviewedById(id, firstName, lastName, email)')
      .eq('findingId', findingId)
      .order('requestedAt', { ascending: false })

    if (error) {
      console.error('Error fetching extension requests:', error)
      return NextResponse.json(
        { error: 'Failed to fetch extension requests' },
        { status: 500 }
      )
    }

    return NextResponse.json(rows ?? [])
  } catch (error) {
    console.error('Error in extension-requests GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch extension requests' },
      { status: 500 }
    )
  }
}
