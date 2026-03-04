import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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

    const { data: checklist, error: checklistError } = await supabase
      .from('Checklist')
      .select('id')
      .eq('id', params.id)
      .single()

    if (checklistError || !checklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      )
    }

    const { data: revisions, error } = await supabase
      .from('ChecklistRevision')
      .select(
        `
        *,
        Checklist:checklistId(
          name,
          version
        )
      `
      )
      .eq('checklistId', params.id)
      .order('createdAt', { ascending: false })

    if (error) {
      console.error('Error fetching checklist revisions from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch checklist revisions' },
        { status: 500 }
      )
    }

    return NextResponse.json(revisions ?? [])
  } catch (error) {
    console.error('Error fetching checklist revisions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checklist revisions' },
      { status: 500 }
    )
  }
}
