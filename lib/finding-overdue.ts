export type OverdueKind = 'NONE' | 'CAP' | 'CAT' | 'FINDING_DUE'

export type OverdueInput = {
  findingStatus?: string | null
  findingDueDate?: string | null
  findingCapDueDate?: string | null
  hasCorrectiveAction?: boolean | null
  caDueDate?: string | null
  capStatus?: string | null
  catDueDate?: string | null
  catStatus?: string | null
  correctiveActionTaken?: string | null
}

export type OverdueEval = {
  isOverdue: boolean
  kind: OverdueKind
}

const isClosedFinding = (status?: string | null): boolean =>
  String(status ?? '').toUpperCase() === 'CLOSED'

const isApproved = (status?: string | null): boolean =>
  String(status ?? '').toUpperCase() === 'APPROVED'

const toTime = (value: string | null | undefined): number | null => {
  if (!value) return null
  const d = new Date(value)
  const t = d.getTime()
  if (Number.isNaN(t)) return null
  return t
}

const isBeforeNow = (value: string | null | undefined, nowIso: string): boolean => {
  const t = toTime(value)
  if (t == null) return false
  const nowT = toTime(nowIso)
  if (nowT == null) return false
  return t < nowT
}

export const isCapOverdue = (input: OverdueInput, nowIso = new Date().toISOString()): boolean => {
  if (isClosedFinding(input.findingStatus)) return false
  const hasCa =
    input.hasCorrectiveAction === true ||
    (typeof input.hasCorrectiveAction === 'boolean' ? input.hasCorrectiveAction : Boolean(input.caDueDate || input.capStatus))

  if (!hasCa) {
    return isBeforeNow(input.findingCapDueDate ?? null, nowIso)
  }

  if (!isBeforeNow(input.caDueDate ?? null, nowIso)) return false
  return !isApproved(input.capStatus)
}

export const isCatOverdue = (input: OverdueInput, nowIso = new Date().toISOString()): boolean => {
  if (isClosedFinding(input.findingStatus)) return false
  if (!isBeforeNow(input.catDueDate ?? null, nowIso)) return false
  if (isApproved(input.catStatus)) return false
  const taken = String(input.correctiveActionTaken ?? '').trim()
  return taken === ''
}

export const evaluateOverdue = (
  input: OverdueInput,
  nowIso = new Date().toISOString()
): OverdueEval => {
  if (isCatOverdue(input, nowIso)) {
    return { isOverdue: true, kind: 'CAT' }
  }
  if (isCapOverdue(input, nowIso)) {
    return { isOverdue: true, kind: 'CAP' }
  }
  if (!isClosedFinding(input.findingStatus) && isBeforeNow(input.findingDueDate ?? null, nowIso)) {
    return { isOverdue: true, kind: 'FINDING_DUE' }
  }
  return { isOverdue: false, kind: 'NONE' }
}
