import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createActivityLog } from '@/lib/activity-log'
import { getCurrentUserProfile, canCreateOrEditChecklist } from '@/lib/permissions'

const incrementVersion = (currentVersion: string): string => {
  const parts = currentVersion.split('.')
  if (parts.length !== 2) {
    // If format is invalid, default to 1.0
    return '1.0'
  }
  
  let major = parseInt(parts[0], 10) || 1
  let minor = parseInt(parts[1], 10) || 0
  
  minor += 1
  if (minor >= 10) {
    major += 1
    minor = 0
  }
  
  return `${major}.${minor}`
}

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

    const { data: checklist, error } = await supabase
      .from('Checklist')
      .select(
        `
        *,
        Items:ChecklistItem(
          *
        ),
        Revisions:ChecklistRevision(
          *,
          Checklist:checklistId(
            name
          )
        )
      `
      )
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching checklist from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch checklist' },
        { status: 500 }
      )
    }

    if (!checklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(checklist)
  } catch (error) {
    console.error('Error fetching checklist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checklist' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canCreateOrEditChecklist(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors can create or edit checklists.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, type, checklistType, isActive, items, changeLog } = body

    const { data: currentChecklist, error: currentError } = await supabase
      .from('Checklist')
      .select('*')
      .eq('id', params.id)
      .single()

    if (currentError || !currentChecklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      )
    }

    // Determine if we need to increment version (only if items are being updated)
    const shouldIncrementVersion = items && Array.isArray(items) && items.length > 0
    const newVersion = shouldIncrementVersion 
      ? incrementVersion(currentChecklist.version || '1.0')
      : currentChecklist.version

    // Update checklist basic info
    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(type !== undefined && { type }),
      ...(checklistType !== undefined && { checklistType }),
      ...(isActive !== undefined && { isActive }),
    }

    // Only update version if items are being changed
    if (shouldIncrementVersion) {
      updateData.version = newVersion
    }

    const { data: checklist, error: updateError } = await supabase
      .from('Checklist')
      .update(updateData)
      .eq('id', params.id)
      .select('*')
      .single()

    if (updateError || !checklist) {
      console.error('Error updating checklist in Supabase:', updateError)
      return NextResponse.json(
        { error: 'Failed to update checklist' },
        { status: 500 }
      )
    }

    if (items && Array.isArray(items)) {
      const { error: deleteItemsError } = await supabase
        .from('ChecklistItem')
        .delete()
        .eq('checklistId', params.id)

      if (deleteItemsError) {
        console.error('Error deleting checklist items in Supabase:', deleteItemsError)
      } else {
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
              checklistId: params.id,
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
            checklistId: params.id,
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

        const { error: revisionError } = await supabase.from('ChecklistRevision').insert({
          checklistId: checklist.id,
          version: newVersion,
          changeLog: changeLog || `Updated checklist items (${items.length} items)`,
          createdById: user.id,
        })

        if (revisionError) {
          console.error('Error creating checklist revision in Supabase:', revisionError)
        }
      }
    }

    const { data: updatedChecklist, error: fetchError } = await supabase
      .from('Checklist')
      .select(
        `
        *,
        Items:ChecklistItem(*)
      `
      )
      .eq('id', params.id)
      .single()

    await createActivityLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Checklist',
      entityId: checklist.id,
      details: `Updated checklist: ${checklist.name}${shouldIncrementVersion ? ` (Version ${newVersion})` : ''}`,
    })

    if (fetchError || !updatedChecklist) {
      return NextResponse.json(checklist)
    }

    return NextResponse.json({
      ...updatedChecklist,
      items: updatedChecklist.Items ?? [],
    })
  } catch (error) {
    console.error('Error updating checklist:', error)
    return NextResponse.json(
      { error: 'Failed to update checklist' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    if (!canCreateOrEditChecklist(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors can create or edit checklists.' },
        { status: 403 }
      )
    }

    const { data: checklist, error } = await supabase
      .from('Checklist')
      .select('id, name')
      .eq('id', params.id)
      .single()

    if (error || !checklist) {
      return NextResponse.json(
        { error: 'Checklist not found' },
        { status: 404 }
      )
    }

    const { data: auditsUsingChecklist, error: auditsError } = await supabase
      .from('Audit')
      .select('id')
      .eq('checklistId', params.id)
      .limit(1)

    if (auditsError) {
      console.error('Error checking checklist usage in audits:', auditsError)
      return NextResponse.json(
        { error: 'Failed to delete checklist' },
        { status: 500 }
      )
    }

    if (auditsUsingChecklist && auditsUsingChecklist.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete checklist that is being used by audits' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase.from('Checklist').delete().eq('id', params.id)

    if (deleteError) {
      console.error('Error deleting checklist in Supabase:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete checklist' },
        { status: 500 }
      )
    }

    await createActivityLog({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Checklist',
      entityId: params.id,
      details: `Deleted checklist: ${checklist.name}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting checklist:', error)
    return NextResponse.json(
      { error: 'Failed to delete checklist' },
      { status: 500 }
    )
  }
}
