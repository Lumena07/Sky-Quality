import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canSeeTraining, getCurrentUserProfile } from '@/lib/permissions'
import { computeAuditorRequalification } from '@/lib/auditor-requalification'

const normalizeRoles = (u: { roles?: unknown; role?: string | null }): string[] => {
  if (Array.isArray(u.roles) && u.roles.length > 0) {
    return u.roles.filter((x): x is string => typeof x === 'string')
  }
  if (u.role) return [u.role]
  return []
}

/** GET: auditors with last audit date and requalification status (QMS personnel training). */
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
    const { roles, departmentId } = await getCurrentUserProfile(supabase, user.id)
    if (!canSeeTraining(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: allUsers, error: uErr } = await supabase
      .from('User')
      .select(
        'id, email, firstName, lastName, position, roles, role, auditorRequalificationCompletedAt, auditorRequalificationCourseNotes'
      )
      .eq('isActive', true)
    if (uErr) {
      return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
    }

    const auditors = (allUsers ?? []).filter((u) => normalizeRoles(u as { roles?: unknown }).includes('AUDITOR'))

    const { data: audits, error: aErr } = await supabase
      .from('Audit')
      .select(
        `
        endDate,
        scheduledDate,
        status,
        AuditAuditor ( userId )
      `
      )
      .in('status', ['COMPLETED', 'CLOSED'])
    if (aErr) {
      console.error('requalification audits', aErr)
    }

    const lastAuditByUser = new Map<string, string>()
    for (const a of audits ?? []) {
      const row = a as {
        endDate?: string | null
        scheduledDate?: string | null
        AuditAuditor?: { userId?: string }[] | { userId?: string } | null
      }
      const dateStr = row.endDate ?? row.scheduledDate
      if (!dateStr) continue
      const raw = row.AuditAuditor
      const links = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []
      for (const link of links) {
        const uid = link?.userId
        if (!uid) continue
        const prev = lastAuditByUser.get(uid)
        if (!prev || dateStr > prev) lastAuditByUser.set(uid, dateStr)
      }
    }

    const result = auditors.map((u) => {
      const ur = u as {
        id: string
        email?: string | null
        firstName?: string | null
        lastName?: string | null
        position?: string | null
        auditorRequalificationCompletedAt?: string | null
        auditorRequalificationCourseNotes?: string | null
      }
      const userRoles = normalizeRoles(u as { roles?: unknown })
      const last = lastAuditByUser.get(ur.id) ?? null
      const comp = computeAuditorRequalification({
        userRoles,
        lastAuditConductedAt: last,
        auditorRequalificationCompletedAt: ur.auditorRequalificationCompletedAt ?? null,
      })
      return {
        id: ur.id,
        email: ur.email,
        firstName: ur.firstName,
        lastName: ur.lastName,
        position: ur.position,
        ...comp,
        requalificationCourseNotes: ur.auditorRequalificationCourseNotes ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
