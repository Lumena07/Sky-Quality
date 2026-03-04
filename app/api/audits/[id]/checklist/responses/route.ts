import { randomUUID } from 'crypto'
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

    const { data: responses, error } = await supabase
      .from('AuditChecklistItemResponse')
      .select(
        `
        *,
        ChecklistItem:checklistItemId(*),
        Reviewer:reviewedById(
          id,
          firstName,
          lastName,
          email
        ),
        Evidence:AuditChecklistEvidence(*)
      `
      )
      .eq('auditId', params.id)
      .order('createdAt', { ascending: true })

    if (error) {
      console.error('Error fetching checklist responses from Supabase:', error)
      return NextResponse.json(
        { error: 'Failed to fetch checklist responses' },
        { status: 500 }
      )
    }

    const { data: findings } = await supabase
      .from('Finding')
      .select('id, findingNumber, checklistItemId, departmentId, description, priority, assignedToId, status')
      .eq('auditId', params.id)
      .not('checklistItemId', 'is', null)

    const findingsByChecklistItemId = new Map<string, typeof findings>()
    ;(findings ?? []).forEach((f: { checklistItemId: string }) => {
      const list = findingsByChecklistItemId.get(f.checklistItemId) ?? []
      list.push(f)
      findingsByChecklistItemId.set(f.checklistItemId, list)
    })

    const enriched = (responses ?? []).map((r: { checklistItemId: string }) => ({
      ...r,
      findings: findingsByChecklistItemId.get(r.checklistItemId) ?? [],
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Error fetching checklist responses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checklist responses' },
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
    const { checklistItemId, isCompliant, notes } = body

    if (!checklistItemId) {
      return NextResponse.json(
        { error: 'Checklist item ID is required' },
        { status: 400 }
      )
    }

    const { data: audit, error: auditError } = await supabase
      .from('Audit')
      .select('id')
      .eq('id', params.id)
      .single()

    if (auditError || !audit) {
      return NextResponse.json(
        { error: 'Audit not found' },
        { status: 404 }
      )
    }

    const { data: existingResponse } = await supabase
      .from('AuditChecklistItemResponse')
      .select('*')
      .eq('auditId', params.id)
      .eq('checklistItemId', checklistItemId)
      .maybeSingle()

    let responseRow

    if (!existingResponse) {
      const now = new Date().toISOString()
      const { data: created, error: createError } = await supabase
        .from('AuditChecklistItemResponse')
        .insert({
          id: randomUUID(),
          auditId: params.id,
          checklistItemId,
          isCompliant,
          notes: notes || null,
          reviewedById: user.id,
          updatedAt: now,
        })
        .select('*')
        .single()

      if (createError || !created) {
        console.error('Error creating checklist response in Supabase:', createError)
        return NextResponse.json(
          { error: 'Failed to save checklist response' },
          { status: 500 }
        )
      }
      responseRow = created
    } else {
      const { data: updated, error: updateError } = await supabase
        .from('AuditChecklistItemResponse')
        .update({
          isCompliant,
          notes: notes || null,
          reviewedById: user.id,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existingResponse.id)
        .select('*')
        .single()

      if (updateError || !updated) {
        console.error('Error updating checklist response in Supabase:', updateError)
        return NextResponse.json(
          { error: 'Failed to save checklist response' },
          { status: 500 }
        )
      }
      responseRow = updated
    }

    const { data: fullResponse, error: fetchError } = await supabase
      .from('AuditChecklistItemResponse')
      .select(
        `
        *,
        ChecklistItem:checklistItemId(*),
        Reviewer:reviewedById(
          id,
          firstName,
          lastName
        ),
        Evidence:AuditChecklistEvidence(*)
      `
      )
      .eq('id', responseRow.id)
      .single()

    if (fetchError || !fullResponse) {
      console.error('Error fetching checklist response from Supabase:', fetchError)
      return NextResponse.json(responseRow)
    }

    return NextResponse.json(fullResponse)
  } catch (error) {
    console.error('Error saving checklist response:', error)
    return NextResponse.json(
      { error: 'Failed to save checklist response' },
      { status: 500 }
    )
  }
}
