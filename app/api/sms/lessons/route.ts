import { NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext, nextSmsIdentifier } from '@/lib/sms'

export async function GET() {
  const { supabase, user } = await getSmsAuthContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('sms_lessons_learned')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPolicy(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const number = await nextSmsIdentifier('sms_lesson', 'SMS-LL')
  const { data, error } = await supabase
    .from('sms_lessons_learned')
    .insert({
      lesson_number: number,
      title: body.title,
      summary: body.summary,
      source: body.source || 'Internal Investigation',
      operational_areas: Array.isArray(body.operationalAreas) ? body.operationalAreas : ['all'],
      details: body.details || null,
      key_learning_points: Array.isArray(body.keyLearningPoints) ? body.keyLearningPoints : [],
      recommended_actions: body.recommendedActions || null,
      related_report_ids: Array.isArray(body.relatedReportIds) ? body.relatedReportIds : [],
      published_at: new Date().toISOString(),
      author_id: user.id,
    })
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 })
  await createSmsAuditLog({ userId: user.id, actionType: 'CREATE', module: 'sms_lessons_learned', recordId: String(data.id), newValue: data })
  return NextResponse.json(data, { status: 201 })
}
