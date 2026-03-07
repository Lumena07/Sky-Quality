import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isNormalUser } from '@/lib/permissions'

/** GET: List training records. Normal users see only their own; reviewers/AM see all (optional filter by userId). */
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

    const { roles } = await getCurrentUserProfile(supabase, user.id)
    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')

    let query = supabase
      .from('TrainingRecord')
      .select(
        `
        *,
        User:userId(id, email, firstName, lastName)
      `
      )
      .order('expiryDate', { ascending: true, nullsFirst: false })

    if (isNormalUser(roles)) {
      query = query.eq('userId', user.id)
    } else if (userIdParam) {
      query = query.eq('userId', userIdParam)
    }

    const { data: records, error } = await query

    if (error) {
      console.error('Error fetching training records:', error)
      return NextResponse.json(
        { error: 'Failed to fetch training records' },
        { status: 500 }
      )
    }

    return NextResponse.json(records ?? [])
  } catch (error) {
    console.error('Error in /api/training:', error)
    return NextResponse.json(
      { error: 'Failed to fetch training records' },
      { status: 500 }
    )
  }
}

/** POST: Create training record. Only reviewers or Accountable Manager. */
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

    const { getCurrentUserRoles, hasReviewerRole, canSeeAmDashboard } = await import('@/lib/permissions')
    const roles = await getCurrentUserRoles(supabase, user.id)
    if (!hasReviewerRole(roles) && !canSeeAmDashboard(roles)) {
      return NextResponse.json(
        { error: 'Only reviewers, Quality Manager, Accountable Manager, or System Admin can create training records' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      userId,
      name,
      code,
      description,
      recordType,
      type,
      completedAt,
      expiryDate,
      documentUrl,
    } = body

    if (!userId || !name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'userId and name are required' },
        { status: 400 }
      )
    }

    const resolvedType = recordType ?? type
    const now = new Date().toISOString()
    const record = {
      id: randomUUID(),
      userId: userId.trim(),
      name: name.trim(),
      code: code?.trim() || null,
      description: description?.trim() || null,
      recordType: resolvedType === 'QUALIFICATION' ? 'QUALIFICATION' : 'TRAINING',
      completedAt: completedAt ? new Date(completedAt).toISOString() : null,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      documentUrl: documentUrl?.trim() || null,
      createdAt: now,
      updatedAt: now,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('TrainingRecord')
      .insert(record)
      .select('*')
      .single()

    if (insertError) {
      console.error('Error creating training record:', insertError)
      return NextResponse.json(
        { error: insertError.message ?? 'Failed to create training record' },
        { status: 500 }
      )
    }

    return NextResponse.json(inserted, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/training:', error)
    return NextResponse.json(
      { error: 'Failed to create training record' },
      { status: 500 }
    )
  }
}
