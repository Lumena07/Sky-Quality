import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'

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

    const { data: checklistItems, error } = await supabase
      .from('ChecklistItem')
      .select('*')
      .eq('auditId', params.id)
      .order('order', { ascending: true })

    if (error) {
      console.error('Error fetching checklist items from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch checklist' },
        { status: 500 }
      )
    }

    return NextResponse.json(checklistItems ?? [])
  } catch (error) {
    console.error('Error fetching checklist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checklist' },
      { status: 500 }
    )
  }
}

export async function POST(
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

    const body = await request.json()
    const { type, content, order, parentId } = body

    const { data: audit, error: auditError } = await supabase
      .from('Audit')
      .select('id')
      .eq('id', params.id)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const { data: checklistItem, error } = await supabase
      .from('ChecklistItem')
      .insert({
        auditId: params.id,
        type,
        content,
        order,
        parentId: parentId || null,
      })
      .select('*')
      .single()

    if (error || !checklistItem) {
      console.error('Error creating checklist item in Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to create checklist item' },
        { status: 500 }
      )
    }

    await createActivityLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'ChecklistItem',
      entityId: checklistItem.id,
      details: `Created checklist item: ${content}`,
      auditId: params.id,
    })

    return NextResponse.json(checklistItem)
  } catch (error) {
    console.error('Error creating checklist item:', error)
    return NextResponse.json(
      { error: 'Failed to create checklist item' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items must be an array' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('ChecklistItem')
      .delete()
      .eq('auditId', params.id)

    if (deleteError) {
      console.error('Error deleting existing checklist items in Supabase:', deleteError)
      return NextResponse.json(
        { error: 'Failed to update checklist' },
        { status: 500 }
      )
    }

    const titles: any[] = []
    const questions: any[] = []

    items.forEach((item: any) => {
      if (item.type === 'title') {
        titles.push(item)
      } else {
        questions.push(item)
      }
    })

    const titleOrderToId = new Map<number, string>()
    const createdTitles = []

    for (const item of titles) {
      const { data: titleRow, error: titleError } = await supabase
        .from('ChecklistItem')
        .insert({
          auditId: params.id,
          type: item.type,
          content: item.content,
          order: item.order,
          parentId: null,
        })
        .select('id, order')
        .single()

      if (titleError || !titleRow) {
        console.error('Error creating title checklist item in Supabase:', titleError)
        continue
      }

      createdTitles.push(titleRow)
      titleOrderToId.set(titleRow.order as number, titleRow.id as string)
    }

    const createdQuestions = []

    for (const item of questions) {
      let parentId: string | null = null
      for (let order = item.order - 1; order >= 0; order -= 1) {
        if (titleOrderToId.has(order)) {
          parentId = titleOrderToId.get(order) ?? null
          break
        }
      }

      const { data: questionRow, error: questionError } = await supabase
        .from('ChecklistItem')
        .insert({
          auditId: params.id,
          type: item.type,
          content: item.content,
          order: item.order,
          parentId,
        })
        .select('*')
        .single()

      if (questionError || !questionRow) {
        console.error('Error creating question checklist item in Supabase:', questionError)
        continue
      }

      createdQuestions.push(questionRow)
    }

    const createdItems = [...createdTitles, ...createdQuestions].sort(
      (a, b) => (a.order as number) - (b.order as number)
    )

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Checklist',
      entityId: params.id,
      details: `Updated checklist with ${items.length} items`,
      auditId: params.id,
    })

    return NextResponse.json(createdItems)
  } catch (error) {
    console.error('Error updating checklist:', error)
    return NextResponse.json(
      { error: 'Failed to update checklist' },
      { status: 500 }
    )
  }
}
