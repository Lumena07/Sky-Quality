import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isNormalUser, canSeeTraining, canAddTraining, canSeeAmDashboard } from '@/lib/permissions'

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

    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeTraining(roles, departmentId)) {
      return NextResponse.json(
        { error: 'Training is only available to Quality department and Accountable Manager' },
        { status: 403 }
      )
    }

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

    if (isNormalUser(roles) && !canSeeAmDashboard(roles)) {
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

    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeTraining(roles, departmentId)) {
      return NextResponse.json(
        { error: 'Training is only available to Quality department and Accountable Manager' },
        { status: 403 }
      )
    }
    if (!canAddTraining(roles)) {
      return NextResponse.json(
        { error: 'Only Quality Manager or auditors can add training or qualification records.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      userId,
      name,
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
