import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, canCreateOrEditChecklist } from '@/lib/permissions'

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    let checklistQuery = supabase
      .from('Checklist')
      .select(
        `
        *,
        Items:ChecklistItem(*)
      `
      )
      .order('createdAt', { ascending: false })

    if (type) {
      checklistQuery = checklistQuery.eq('type', type)
    }
    if (isActive !== null) {
      checklistQuery = checklistQuery.eq('isActive', isActive === 'true')
    }

    const [{ data: checklistRows, error: checklistError }, { data: auditRows, error: auditError }] = await Promise.all([
      checklistQuery,
      supabase.from('Audit').select('id, checklistId'),
    ])

    if (checklistError || auditError) {
      console.error('Error fetching checklists from Supabase:', checklistError || auditError)
      return NextResponse.json(
        { error: 'Failed to fetch checklists' },
        { status: 500 }
      )
    }

    const auditCountByChecklistId = new Map<string, number>()
    ;(auditRows ?? []).forEach((audit) => {
      const key = audit.checklistId as string | null
      if (!key) {
        return
      }
      const current = auditCountByChecklistId.get(key) ?? 0
      auditCountByChecklistId.set(key, current + 1)
    })

    const checklistsWithCounts = (checklistRows ?? []).map((checklist) => ({
      ...checklist,
      items: checklist.Items ?? [],
      _count: {
        audits: auditCountByChecklistId.get(checklist.id) ?? 0,
      },
    }))

    return NextResponse.json(checklistsWithCounts)
  } catch (error) {
    console.error('Error fetching checklists:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checklists' },
      { status: 500 }
    )
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
    if (!canCreateOrEditChecklist(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors can create or edit checklists.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, type, checklistType, items } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const { data: checklist, error: checklistError } = await supabase
      .from('Checklist')
      .insert({
        id: randomUUID(),
        name,
        description,
        type,
        checklistType: checklistType || 'Internal',
        version: '1.0',
        createdById: user.id,
        updatedAt: now,
      })
      .select('*')
      .single()

    if (checklistError || !checklist) {
      console.error('Error creating checklist in Supabase:', checklistError)
      return NextResponse.json(
        { error: 'Failed to create checklist' },
        { status: 500 }
      )
    }

    const { error: revisionError } = await supabase.from('ChecklistRevision').insert({
      checklistId: checklist.id,
      version: '1.0',
      changeLog: 'Initial version',
      createdById: user.id,
    })

    if (revisionError) {
      console.error('Error creating checklist revision in Supabase:', revisionError)
    }

    if (items && Array.isArray(items) && items.length > 0) {
      const titles: any[] = []
      const questions: any[] = []

      items.forEach((item: any, index: number) => {
        if (!item.type || typeof item.type !== 'string') {
          throw new Error(`Item at index ${index} is missing required field 'type'`)
        }
        if (item.content === undefined || item.content === null) {
          throw new Error(`Item at index ${index} is missing required field 'content'`)
        }
        if (item.order === undefined || item.order === null || typeof item.order !== 'number') {
          throw new Error(`Item at index ${index} is missing required field 'order' or it's not a number`)
        }

        const itemWithOrder = {
          ...item,
          order: typeof item.order === 'number' ? item.order : index,
          content: item.content ?? '',
          type: item.type,
        }

        if (itemWithOrder.type === 'title') {
          titles.push(itemWithOrder)
        } else {
          questions.push(itemWithOrder)
        }
      })

      const titleOrderToId = new Map<number, string>()

      for (const item of titles) {
        const { data: titleRow, error: titleError } = await supabase
          .from('ChecklistItem')
          .insert({
            checklistId: checklist.id,
            type: item.type,
            content: item.content ?? '',
            ref: item.ref ?? null,
            auditQuestion: item.auditQuestion ?? null,
            complianceCriteria: item.complianceCriteria ?? null,
            docRef: item.docRef ?? null,
            order: Number(item.order),
            parentId: null,
          })
          .select('id, order')
          .single()

        if (titleError || !titleRow) {
          console.error('Error creating checklist title item in Supabase:', titleError)
          continue
        }

        titleOrderToId.set(titleRow.order as number, titleRow.id as string)
      }

      for (const item of questions) {
        let parentId: string | null = null
        for (let order = item.order - 1; order >= 0; order -= 1) {
          if (titleOrderToId.has(order)) {
            parentId = titleOrderToId.get(order) ?? null
            break
          }
        }

        const { error: questionError } = await supabase.from('ChecklistItem').insert({
          checklistId: checklist.id,
          type: item.type,
          content: item.content ?? '',
          ref: item.ref ?? null,
          auditQuestion: item.auditQuestion ?? null,
          complianceCriteria: item.complianceCriteria ?? null,
          docRef: item.docRef ?? null,
          order: Number(item.order),
          parentId,
        })

        if (questionError) {
          console.error('Error creating checklist question item in Supabase:', questionError)
        }
      }
    }

    const { data: checklistWithItems, error: fetchError } = await supabase
      .from('Checklist')
      .select(
        `
        *,
        Items:ChecklistItem(
          *
        )
      `
      )
      .eq('id', checklist.id)
      .single()

    if (fetchError) {
      console.error('Error fetching created checklist from Supabase:', fetchError)
    }

    await createActivityLog({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Checklist',
      entityId: checklist.id,
      details: `Created checklist: ${name}`,
    })

    if (!checklistWithItems) {
      return NextResponse.json(checklist)
    }

    return NextResponse.json({
      ...checklistWithItems,
      items: checklistWithItems.Items ?? [],
    })
  } catch (error) {
    console.error('Error creating checklist:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create checklist', details: errorMessage },
      { status: 500 }
    )
  }
}
