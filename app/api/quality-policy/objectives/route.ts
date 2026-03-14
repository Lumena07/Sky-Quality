import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canManageQualityPolicy } from '@/lib/permissions'
import { randomUUID } from 'crypto'

/** POST: Create or update quality objectives for a year. Quality Manager only. */
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
    if (!canManageQualityPolicy(roles)) {
      return NextResponse.json(
        { error: 'Forbidden: Quality Manager only' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const year = typeof body.year === 'number' ? body.year : parseInt(String(body.year), 10)
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Valid year (2000–2100) is required' },
        { status: 400 }
      )
    }

    const objectivesPdfUrl =
      body.objectivesPdfUrl !== undefined
        ? (body.objectivesPdfUrl as string | null)
        : undefined
    const objectivesText =
      body.objectivesText !== undefined
        ? (body.objectivesText as string | null)
        : undefined

    const updatedAt = new Date().toISOString()
    const { data: existing } = await supabase
      .from('QualityObjectives')
      .select('id')
      .eq('year', year)
      .maybeSingle()

    if (existing?.id) {
      const payload: Record<string, unknown> = {
        updatedAt,
        updatedById: user.id,
      }
      if (objectivesPdfUrl !== undefined) payload.objectivesPdfUrl = objectivesPdfUrl
      if (objectivesText !== undefined) payload.objectivesText = objectivesText

      const { data, error } = await supabase
        .from('QualityObjectives')
        .update(payload)
        .eq('id', existing.id)
        .select('id, year, objectivesPdfUrl, objectivesText, updatedAt, updatedById')
        .single()

      if (error) {
        console.error('Error updating QualityObjectives:', error)
        return NextResponse.json(
          { error: 'Failed to update quality objectives' },
          { status: 500 }
        )
      }
      return NextResponse.json(data)
    }

    const id = randomUUID()
    const { data, error } = await supabase
      .from('QualityObjectives')
      .insert({
        id,
        year,
        objectivesPdfUrl: objectivesPdfUrl ?? null,
        objectivesText: objectivesText ?? null,
        updatedAt,
        updatedById: user.id,
      })
      .select('id, year, objectivesPdfUrl, objectivesText, updatedAt, updatedById')
      .single()

    if (error) {
      console.error('Error inserting QualityObjectives:', error)
      return NextResponse.json(
        { error: 'Failed to create quality objectives' },
        { status: 500 }
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in POST /api/quality-policy/objectives:', error)
    return NextResponse.json(
      { error: 'Failed to save quality objectives' },
      { status: 500 }
    )
  }
}

/** DELETE: Remove quality objectives by id or year. Quality Manager only. */
export async function DELETE(request: Request) {
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
    if (!canManageQualityPolicy(roles)) {
      return NextResponse.json(
        { error: 'Forbidden: Quality Manager only' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const yearParam = searchParams.get('year')

    if (id && id.trim()) {
      const { error } = await supabase
        .from('QualityObjectives')
        .delete()
        .eq('id', id.trim())

      if (error) {
        console.error('Error deleting QualityObjectives by id:', error)
        return NextResponse.json(
          { error: 'Failed to delete quality objectives' },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true })
    }

    if (yearParam) {
      const year = parseInt(yearParam, 10)
      if (Number.isNaN(year)) {
        return NextResponse.json(
          { error: 'Valid year query parameter required' },
          { status: 400 }
        )
      }
      const { error } = await supabase
        .from('QualityObjectives')
        .delete()
        .eq('year', year)

      if (error) {
        console.error('Error deleting QualityObjectives by year:', error)
        return NextResponse.json(
          { error: 'Failed to delete quality objectives' },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Query parameter id or year is required' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in DELETE /api/quality-policy/objectives:', error)
    return NextResponse.json(
      { error: 'Failed to delete quality objectives' },
      { status: 500 }
    )
  }
}
