import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
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

    const body = await request.json()
    const { content, order, type } = body

    const updateData: Record<string, unknown> = {}
    if (content !== undefined) {
      updateData.content = content
    }
    if (order !== undefined) {
      updateData.order = order
    }
    if (type !== undefined) {
      updateData.type = type
    }

    const { data: checklistItem, error } = await supabase
      .from('ChecklistItem')
      .update(updateData)
      .eq('id', params.itemId)
      .select('*')
      .single()

    if (error || !checklistItem) {
      console.error('Error updating checklist item in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to update checklist item' },
        { status: 500 }
      )
    }

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'ChecklistItem',
      entityId: checklistItem.id,
      details: `Updated checklist item: ${checklistItem.content}`,
      auditId: params.id,
    })

    return NextResponse.json(checklistItem)
  } catch (error) {
    console.error('Error updating checklist item:', error)
    return NextResponse.json(
      { error: 'Failed to update checklist item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
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

    const { data: checklistItem, error: fetchError } = await supabase
      .from('ChecklistItem')
      .select('*')
      .eq('id', params.itemId)
      .single()

    if (fetchError || !checklistItem) {
      return NextResponse.json(
        { error: 'Checklist item not found' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabase
      .from('ChecklistItem')
      .delete()
      .eq('id', params.itemId)

    if (deleteError) {
      console.error('Error deleting checklist item in Supabase:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete checklist item' },
        { status: 500 }
      )
    }

    await createActivityLog({
      userId: user.id,
      action: 'DELETE',
      entityType: 'ChecklistItem',
      entityId: params.itemId,
      details: `Deleted checklist item: ${checklistItem.content}`,
      auditId: params.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting checklist item:', error)
    return NextResponse.json(
      { error: 'Failed to delete checklist item' },
      { status: 500 }
    )
  }
}
