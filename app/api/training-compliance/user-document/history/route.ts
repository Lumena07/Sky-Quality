import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageTrainingCompliance, getCurrentUserProfile } from '@/lib/permissions'

const HISTORY_LIMIT = 50

/** GET: prior snapshots for a user’s compliance document (newest first). */
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
    if (!canManageTrainingCompliance(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = typeof searchParams.get('userId') === 'string' ? searchParams.get('userId')!.trim() : ''
    const rawKind = typeof searchParams.get('documentKind') === 'string' ? searchParams.get('documentKind')!.trim() : ''
    const documentKind = rawKind.toUpperCase()
    if (!userId || !documentKind) {
      return NextResponse.json({ error: 'userId and documentKind required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('UserComplianceDocumentHistory')
      .select('id, createdAt, expiryDate, pdfFileUrl, createdById')
      .eq('userId', userId)
      .eq('documentKind', documentKind)
      .order('createdAt', { ascending: false })
      .limit(HISTORY_LIMIT)

    if (error) {
      console.error('user-document history list', error)
      return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
