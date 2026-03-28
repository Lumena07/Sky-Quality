import { parseAircraftTypeCodesStrict } from '@/lib/aircraft-types'

export const rolesFromUserRow = (row: {
  roles?: unknown
  role?: string | null
}): string[] => {
  const r = row.roles
  if (Array.isArray(r) && r.length > 0) {
    const out = r
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean)
    return Array.from(new Set(out))
  }
  if (typeof row.role === 'string' && row.role.trim()) return [row.role.trim()]
  return []
}

export const PILOT_SEAT_VALUES = ['CAPTAIN', 'FIRST_OFFICER'] as const
export type PilotSeat = (typeof PILOT_SEAT_VALUES)[number]

const PILOT_SEAT_SET = new Set<string>(PILOT_SEAT_VALUES)

export type PilotRoleMetadata = {
  aircraftTypeCodes: string[]
  pilotSeat: PilotSeat
}

export type DispatcherRoleMetadata = {
  aircraftTypeCodes: string[]
}

export type UserRoleMetadata = {
  PILOT?: PilotRoleMetadata
  FLIGHT_DISPATCHERS?: DispatcherRoleMetadata
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const normalizePilotSeat = (v: unknown): PilotSeat | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().toUpperCase().replace(/[-\s]+/g, '_')
  const mapped =
    s === 'FIRSTOFFICER' || s === 'FO' ? 'FIRST_OFFICER' : s === 'CAPT' ? 'CAPTAIN' : s
  if (mapped === 'CAPTAIN' || mapped === 'FIRST_OFFICER') return mapped
  return null
}

/**
 * Builds roleMetadata for the given roles: strips keys not in `roles`, validates required blocks.
 * Returns null if no keys remain.
 */
export const sanitizeRoleMetadataForRoles = (
  roles: string[],
  raw: unknown
):
  | { ok: true; value: UserRoleMetadata | null }
  | { ok: false; error: string } => {
  const roleSet = new Set(roles)
  const base = isPlainObject(raw) ? raw : {}

  const out: UserRoleMetadata = {}

  if (roleSet.has('PILOT')) {
    const block = base.PILOT
    if (!isPlainObject(block)) {
      return { ok: false, error: 'Pilot role requires pilot seat and at least one aircraft type' }
    }
    const parsed = parseAircraftTypeCodesStrict(block.aircraftTypeCodes, 'Pilot')
    if (!parsed.ok) return parsed
    const seat = normalizePilotSeat(block.pilotSeat)
    if (!seat || !PILOT_SEAT_SET.has(seat)) {
      return { ok: false, error: 'Pilot role requires seat: Captain or First Officer' }
    }
    out.PILOT = { aircraftTypeCodes: parsed.codes, pilotSeat: seat }
  }

  if (roleSet.has('FLIGHT_DISPATCHERS')) {
    const block = base.FLIGHT_DISPATCHERS
    if (!isPlainObject(block)) {
      return {
        ok: false,
        error: 'Flight dispatcher role requires at least one aircraft type',
      }
    }
    const parsed = parseAircraftTypeCodesStrict(block.aircraftTypeCodes, 'Flight dispatcher')
    if (!parsed.ok) return parsed
    out.FLIGHT_DISPATCHERS = { aircraftTypeCodes: parsed.codes }
  }

  if (Object.keys(out).length === 0) return { ok: true, value: null }
  return { ok: true, value: out }
}
