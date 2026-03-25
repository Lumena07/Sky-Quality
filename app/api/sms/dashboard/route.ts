import { NextResponse } from 'next/server'
import { getSmsAuthContext } from '@/lib/sms'

export async function GET() {
  const { supabase, user } = await getSmsAuthContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [hazards, investigations, capas, reports, training] = await Promise.all([
    supabase.from('sms_hazards').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
    supabase.from('sms_investigations').select('id', { count: 'exact', head: true }).neq('status', 'CLOSED'),
    supabase.from('sms_capas').select('id', { count: 'exact', head: true }).in('status', ['OPEN', 'IN_PROGRESS']),
    supabase.from('sms_reports').select('id', { count: 'exact', head: true }).eq('status', 'NEW'),
    supabase
      .from('sms_training_staff')
      .select('id', { count: 'exact', head: true })
      .gte('expiry_date', new Date().toISOString().slice(0, 10)),
  ])

  return NextResponse.json({
    openHazards: hazards.count ?? 0,
    openInvestigations: investigations.count ?? 0,
    openCapas: capas.count ?? 0,
    newReports: reports.count ?? 0,
    currentTrainingRecords: training.count ?? 0,
  })
}
