import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentUserProfile, isQualityManager } from '@/lib/permissions'
import { loadQmsAuditReportAggregate } from '@/lib/qms-audit-report-data'
import { buildTcaaAuditReportPdf } from '@/lib/export/tcaa-audit-report-pdf'

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
    if (!isQualityManager(roles)) {
      return NextResponse.json({ error: 'Quality Manager only' }, { status: 403 })
    }

    const body = await request.json()
    const periodStart = new Date(body.periodStart)
    const periodEnd = new Date(body.periodEnd)
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid periodStart / periodEnd' }, { status: 400 })
    }
    const reportType = typeof body.reportType === 'string' && body.reportType.trim() ? body.reportType.trim() : 'Summary'
    const periodLabel =
      typeof body.periodLabel === 'string' && body.periodLabel.trim()
        ? body.periodLabel.trim()
        : `${periodStart.toISOString().slice(0, 10)} – ${periodEnd.toISOString().slice(0, 10)}`
    const executiveSummaryText =
      typeof body.executiveSummaryText === 'string' ? body.executiveSummaryText.trim() || null : null

    const { data: settings } = await supabase.from('QmsSettings').select('*').eq('id', 'singleton').maybeSingle()
    const settingsRow =
      (settings as {
        operatorLegalName?: string | null
        aocNumber?: string | null
        reportFooterText?: string | null
      }) ?? null

    const now = new Date().toISOString()
    const base = await loadQmsAuditReportAggregate(supabase, periodStart, periodEnd, settingsRow)
    const pdfInput = {
      ...base,
      reportType,
      periodLabel,
      executiveSummaryText,
      generatedAt: now,
    }
    const pdfBuffer = buildTcaaAuditReportPdf(pdfInput)

    const dir = join(process.cwd(), 'public', 'uploads', 'qms-audit-report')
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.pdf`
    const diskPath = join(dir, fileName)
    await writeFile(diskPath, pdfBuffer)
    const pdfFileUrl = `/uploads/qms-audit-report/${fileName}`

    const logId = randomUUID()
    const { data: logRow, error: logErr } = await supabase
      .from('TcaaAuditReportLog')
      .insert({
        id: logId,
        reportType,
        periodLabel,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        executiveSummaryText,
        pdfFileUrl,
        generatedAt: now,
        generatedById: user.id,
      })
      .select('*')
      .single()

    if (logErr || !logRow) {
      console.error('TcaaAuditReportLog insert', logErr)
      return NextResponse.json({ error: 'Failed to save report log' }, { status: 500 })
    }

    return NextResponse.json(logRow, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
