import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, canManageQualityPolicy } from '@/lib/permissions'
import { randomUUID } from 'crypto'

/** GET: Return current quality policy and all objectives. Any authenticated user. */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [policyRes, objectivesRes] = await Promise.all([
      supabase
        .from('QualityPolicy')
        .select('id, policyPdfUrl, policyText, updatedAt, updatedById')
        .order('updatedAt', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('QualityObjectives')
        .select('id, year, objectivesPdfUrl, objectivesText, updatedAt, updatedById')
        .order('year', { ascending: false }),
    ])

    if (policyRes.error) {
      console.error('Error fetching QualityPolicy:', policyRes.error)
      return NextResponse.json(
        { error: 'Failed to fetch quality policy' },
        { status: 500 }
      )
    }
    if (objectivesRes.error) {
      console.error('Error fetching QualityObjectives:', objectivesRes.error)
      return NextResponse.json(
        { error: 'Failed to fetch quality objectives' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      policy: policyRes.data ?? null,
      objectives: objectivesRes.data ?? [],
    })
  } catch (error) {
    console.error('Error in GET /api/quality-policy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quality policy and objectives' },
      { status: 500 }
    )
  }
}

/** PATCH: Update quality policy (PDF and/or text). Quality Manager only. */
export async function PATCH(request: Request) {
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
    const policyPdfUrl =
      body.policyPdfUrl !== undefined ? (body.policyPdfUrl as string | null) : undefined
    const policyText =
      body.policyText !== undefined ? (body.policyText as string | null) : undefined

    const { data: existing } = await supabase
      .from('QualityPolicy')
      .select('id')
      .order('updatedAt', { ascending: false })
      .limit(1)
      .maybeSingle()

    const updatedAt = new Date().toISOString()
    const payload: Record<string, unknown> = {
      updatedAt,
      updatedById: user.id,
    }
    if (policyPdfUrl !== undefined) payload.policyPdfUrl = policyPdfUrl
    if (policyText !== undefined) payload.policyText = policyText

    if (existing?.id) {
      const { data, error } = await supabase
        .from('QualityPolicy')
        .update(payload)
        .eq('id', existing.id)
        .select('id, policyPdfUrl, policyText, updatedAt, updatedById')
        .single()

      if (error) {
        console.error('Error updating QualityPolicy:', error)
        return NextResponse.json(
          { error: 'Failed to update quality policy' },
          { status: 500 }
        )
      }
      return NextResponse.json(data)
    }

    const id = randomUUID()
    const { data, error } = await supabase
      .from('QualityPolicy')
      .insert({
        id,
        policyPdfUrl: payload.policyPdfUrl ?? null,
        policyText: payload.policyText ?? null,
        updatedAt: payload.updatedAt,
        updatedById: payload.updatedById,
      })
      .select('id, policyPdfUrl, policyText, updatedAt, updatedById')
      .single()

    if (error) {
      console.error('Error inserting QualityPolicy:', error)
      return NextResponse.json(
        { error: 'Failed to create quality policy' },
        { status: 500 }
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/quality-policy:', error)
    return NextResponse.json(
      { error: 'Failed to update quality policy' },
      { status: 500 }
    )
  }
}
