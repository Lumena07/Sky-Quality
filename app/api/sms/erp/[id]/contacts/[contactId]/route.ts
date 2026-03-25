import { NextResponse } from 'next/server'
import { canManageSmsPolicy } from '@/lib/sms-permissions'
import { createSmsAuditLog, getSmsAuthContext } from '@/lib/sms'

type RouteContext = { params: Promise<{ id: string; contactId: string }> }

export const DELETE = async (_request: Request, context: RouteContext) => {
  const { id: erpId, contactId } = await context.params
  const { supabase, user, profile } = await getSmsAuthContext()
  if (!user || !profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageSmsPolicy(profile.roles)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: row, error: fetchErr } = await supabase
    .from('sms_erp_contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle()
  if (fetchErr) return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 })
  if (!row || String(row.erp_id) !== erpId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('sms_erp_contacts').delete().eq('id', contactId)
  if (error) return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })

  await createSmsAuditLog({
    userId: user.id,
    actionType: 'DELETE',
    module: 'sms_erp_contacts',
    recordId: contactId,
    oldValue: row,
  })

  return NextResponse.json({ ok: true })
}
