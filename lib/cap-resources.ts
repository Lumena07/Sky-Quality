/** CAP resource categories (stored on CorrectiveAction.capResourceTypes). */
export const CAP_RESOURCE_VALUES = [
  'NONE',
  'HUMAN',
  'FINANCIAL',
  'TRAINING',
  'EQUIPMENT',
  'SYSTEMS_SOFTWARE',
] as const

export type CapResourceValue = (typeof CAP_RESOURCE_VALUES)[number]

export const CAP_RESOURCE_LABELS: Record<CapResourceValue, string> = {
  NONE: 'No extra resources required',
  HUMAN: 'Human resources',
  FINANCIAL: 'Financial resources',
  TRAINING: 'Training resources',
  EQUIPMENT: 'Equipment & tools',
  SYSTEMS_SOFTWARE: 'Systems / software',
}

/** External / third-party audits: no CAP resource categories and no AM resource gate on CAP/CAT. */
export const auditTypeSkipsCapResourceAccountableManager = (
  auditType: string | null | undefined
): boolean => {
  const t = String(auditType ?? '').toUpperCase()
  return t === 'EXTERNAL' || t === 'THIRD_PARTY'
}

/** True if CAP needs Accountable Manager approval after Quality Manager approves (any non-NONE selection). */
export const capRequiresAccountableManager = (
  types: string[] | null | undefined
): boolean => {
  if (!types || types.length === 0) return false
  const norm = types.map((t) => String(t).toUpperCase().trim())
  if (norm.includes('NONE') && norm.length > 1) return true
  if (norm.every((t) => t === 'NONE')) return false
  return norm.some((t) => t !== 'NONE')
}

export const normalizeCapResourceTypes = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).toUpperCase().trim()).filter(Boolean)
}

export const validateCapResourceTypes = (
  types: string[]
): { ok: true } | { ok: false; error: string } => {
  const allowed = new Set(CAP_RESOURCE_VALUES as unknown as string[])
  for (const t of types) {
    if (!allowed.has(t)) {
      return { ok: false, error: `Invalid resource type: ${t}` }
    }
  }
  if (types.includes('NONE') && types.length > 1) {
    return { ok: false, error: 'If "No extra resources" is selected, it must be the only option' }
  }
  return { ok: true }
}
