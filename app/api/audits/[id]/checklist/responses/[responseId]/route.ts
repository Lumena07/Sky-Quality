import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getServerSession } from '@/lib/supabaseServer'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; responseId: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { session } } = await getServerSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: row, error: fetchError } = await supabase
      .from('AuditChecklistItemResponse')
      .select('id, auditId')
      .eq('id', params.responseId)
      .eq('auditId', params.id)
      .single()

    if (fetchError || !row) {
      return NextResponse.json(
        { error: 'Checklist response not found' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabase
      .from('AuditChecklistItemResponse')
      .delete()
      .eq('id', params.responseId)

    if (deleteError) {
      console.error('Error deleting checklist response from Supabase:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete entry' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting checklist response:', error)
    return NextResponse.json(
      { error: 'Failed to delete entry' },
      { status: 500 }
    )
  }
}
