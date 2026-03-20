import { createSupabaseServerClient } from '@/lib/supabaseServer'

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

export const getAuditorAndAuditeeIdsForAudit = async (
  supabase: SupabaseClient,
  auditId: string
): Promise<{ auditorIds: string[]; auditeeIds: string[] }> => {
  const { data: auditorRows } = await supabase
    .from('AuditAuditor')
    .select('userId')
    .eq('auditId', auditId)
  const auditorIds = (auditorRows ?? []).map((r: { userId: string }) => r.userId)
  const { data: auditeeRows } = await supabase
    .from('AuditAuditee')
    .select('userId')
    .eq('auditId', auditId)
  const auditeeIds = (auditeeRows ?? [])
    .map((r: { userId: string | null }) => r.userId)
    .filter(Boolean) as string[]
  return { auditorIds, auditeeIds }
}
