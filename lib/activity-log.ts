import { randomUUID } from 'crypto'
import { createSupabaseServerClient } from './supabaseServer'

/**
 * Safely creates an activity log entry.
 * Verifies the user exists before creating the log to prevent foreign key violations.
 * If the user doesn't exist or an error occurs, the error is logged but not thrown.
 */
export const createActivityLog = async (data: {
  userId: string
  action: string
  entityType: string
  entityId: string
  details?: string | null
  auditId?: string | null
  findingId?: string | null
  correctiveActionId?: string | null
  documentId?: string | null
}) => {
  try {
    const supabase = createSupabaseServerClient()

    // Verify user exists first
    const { data: userExists, error: userError } = await supabase
      .from('User')
      .select('id')
      .eq('id', data.userId)
      .maybeSingle()

    if (userError) {
      console.error('Failed to verify user before activity log:', userError)
      return
    }

    if (!userExists) {
      console.warn(`User ${data.userId} does not exist, skipping activity log`)
      return
    }

    const { error } = await supabase.from('ActivityLog').insert({
      id: randomUUID(),
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      details: data.details || null,
      auditId: data.auditId || null,
      findingId: data.findingId || null,
      correctiveActionId: data.correctiveActionId || null,
      documentId: data.documentId || null,
    })

    if (error) {
      console.error('Failed to create activity log in Supabase:', error)
    }
  } catch (error) {
    // Log error but don't throw - activity logging should never break the main operation
    console.error('Failed to create activity log:', error)
  }
}
