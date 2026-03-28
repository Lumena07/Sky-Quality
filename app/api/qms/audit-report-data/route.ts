import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isQualityManager } from '@/lib/permissions'
import { loadQmsAuditReportAggregate } from '@/lib/qms-audit-report-data'

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
    if (!isQualityManager(roles)) {
      return NextResponse.json({ error: 'Quality Manager only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startStr = searchParams.get('periodStart')
    const endStr = searchParams.get('periodEnd')
    if (!startStr || !endStr) {
      return NextResponse.json(
        { error: 'periodStart and periodEnd (ISO date) are required' },
        { status: 400 }
      )
    }
    const periodStart = new Date(startStr)
    const periodEnd = new Date(endStr)
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid period dates' }, { status: 400 })
    }

    const { data: settings } = await supabase.from('QmsSettings').select('*').eq('id', 'singleton').maybeSingle()

    const aggregate = await loadQmsAuditReportAggregate(
      supabase,
      periodStart,
      periodEnd,
      (settings as { operatorLegalName?: string | null; aocNumber?: string | null; reportFooterText?: string | null }) ??
        null
    )

    return NextResponse.json({
      settings: settings ?? {},
      aggregate: {
        ...aggregate,
        periodStart: aggregate.periodStart,
        periodEnd: aggregate.periodEnd,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to load audit report data' }, { status: 500 })
  }
}
