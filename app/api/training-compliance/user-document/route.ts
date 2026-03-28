import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { canManageTrainingCompliance, getCurrentUserProfile } from '@/lib/permissions'
import { userMatchesPersonalDocumentKind } from '@/lib/training-compliance-applicability'

const isAllowedPdfUrl = (url: string): boolean => {
  const t = url.trim()
  return t.startsWith('/uploads/') && !t.includes('..')
}

const normExpiryDay = (v: unknown): string | null => {
  if (v == null) return null
  if (typeof v === 'string') return v.slice(0, 10)
  return null
}

const normFileUrl = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null
  return v.trim()
}

/** POST: upsert personal compliance document (PDF + expiry). */
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
    if (!canManageTrainingCompliance(roles, departmentId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const rawKind = typeof body.documentKind === 'string' ? body.documentKind.trim() : ''
    const documentKind = rawKind.toUpperCase()
    if (!targetUserId || !documentKind) {
      return NextResponse.json({ error: 'userId and documentKind required' }, { status: 400 })
    }

    const { data: kindRow, error: kindErr } = await supabase
      .from('CompliancePersonalDocumentKind')
      .select('code, applicableRoles')
      .eq('code', documentKind)
      .maybeSingle()
    if (kindErr || !kindRow) {
      return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
    }

    const { data: targetProfile, error: tpErr } = await supabase
      .from('User')
      .select('id, roles, role')
      .eq('id', targetUserId)
      .maybeSingle()
    if (tpErr || !targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (!userMatchesPersonalDocumentKind(targetProfile, kindRow)) {
      return NextResponse.json(
        { error: 'This document type does not apply to the selected user’s roles' },
        { status: 400 }
      )
    }

    const expiryDate =
      typeof body.expiryDate === 'string' && body.expiryDate.trim()
        ? String(body.expiryDate).slice(0, 10)
        : null
    const pdfFileUrl =
      typeof body.pdfFileUrl === 'string' && body.pdfFileUrl.trim() ? body.pdfFileUrl.trim() : null
    if (pdfFileUrl && !isAllowedPdfUrl(pdfFileUrl)) {
      return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 })
    }
    const now = new Date().toISOString()

    const { data: existing } = await supabase
      .from('UserComplianceDocument')
      .select('id, expiryDate, pdfFileUrl')
      .eq('userId', targetUserId)
      .eq('documentKind', documentKind)
      .maybeSingle()

    const prev = existing as { id?: string; expiryDate?: unknown; pdfFileUrl?: unknown } | null
    const id = prev?.id ?? randomUUID()

    const prevExpiry = normExpiryDay(prev?.expiryDate ?? null)
    const prevUrl = normFileUrl(prev?.pdfFileUrl ?? null)
    const nextExpiry = expiryDate
    const nextUrl = normFileUrl(pdfFileUrl)
    if (
      prev &&
      (prevExpiry !== nextExpiry || prevUrl !== nextUrl)
    ) {
      const { error: histErr } = await supabase.from('UserComplianceDocumentHistory').insert({
        id: randomUUID(),
        userId: targetUserId,
        documentKind,
        createdAt: now,
        createdById: user.id,
        expiryDate: prevExpiry,
        pdfFileUrl: prevUrl,
      })
      if (histErr) {
        console.error('user-document history insert', histErr)
        return NextResponse.json({ error: 'Failed to record document history' }, { status: 500 })
      }
    }

    const { data, error } = await supabase
      .from('UserComplianceDocument')
      .upsert(
        {
          id,
          userId: targetUserId,
          documentKind,
          expiryDate,
          pdfFileUrl,
          updatedAt: now,
          updatedById: user.id,
        },
        { onConflict: 'userId,documentKind' }
      )
      .select('*')
      .single()

    if (error || !data) {
      console.error('user-document upsert', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
