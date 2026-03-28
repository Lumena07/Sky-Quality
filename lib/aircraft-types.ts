/** Fleet / type codes allowed on user role metadata (pilot, dispatcher). Extend via deploy. */
export const AIRCRAFT_TYPE_CODES = [
  'C208',
  'B737',
  'B787',
  'ATR72',
  'DHC8',
] as const

export type AircraftTypeCode = (typeof AIRCRAFT_TYPE_CODES)[number]

const ALLOWED = new Set<string>(AIRCRAFT_TYPE_CODES)

export const normalizeAircraftTypeCode = (s: string): string => s.trim().toUpperCase()

export const isAllowedAircraftTypeCode = (s: string): boolean =>
  ALLOWED.has(normalizeAircraftTypeCode(s))

export const AIRCRAFT_TYPE_OPTIONS: ReadonlyArray<{ value: AircraftTypeCode; label: string }> =
  AIRCRAFT_TYPE_CODES.map((value) => ({ value, label: value }))

/** Deduplicated, uppercased, allowlist-only; invalid entries skipped. */
export const sanitizeAircraftTypeCodes = (input: unknown): string[] => {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of input) {
    if (typeof x !== 'string') continue
    const c = normalizeAircraftTypeCode(x)
    if (!c || !ALLOWED.has(c) || seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

/** Non-empty array; every element must be on the allowlist (no silent drops). */
export const parseAircraftTypeCodesStrict = (
  input: unknown,
  label: string
):
  | { ok: true; codes: string[] }
  | { ok: false; error: string } => {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: `${label}: at least one aircraft type is required` }
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of input) {
    if (typeof x !== 'string' || !x.trim()) {
      return { ok: false, error: `${label}: invalid aircraft type entry` }
    }
    const c = normalizeAircraftTypeCode(x)
    if (!ALLOWED.has(c)) {
      return { ok: false, error: `${label}: unknown aircraft type "${x.trim()}"` }
    }
    if (seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  if (out.length === 0) {
    return { ok: false, error: `${label}: at least one aircraft type is required` }
  }
  return { ok: true, codes: out }
}
