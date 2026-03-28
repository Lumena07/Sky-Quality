'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RoleAssignmentOption } from '@/lib/department-role-catalog'
import { AIRCRAFT_TYPE_OPTIONS } from '@/lib/aircraft-types'
import type { PilotSeat } from '@/lib/role-metadata'

/** Role-related slice shared by add-user and edit-user forms. */
export type SharedRoleFormFields = {
  roles: string[]
  safetyOperationalArea: string
  pilotSeat: PilotSeat | ''
  pilotAircraftTypes: string[]
  dispatcherAircraftTypes: string[]
}

type UserRoleFieldsProps<F extends SharedRoleFormFields> = {
  form: F
  setForm: Dispatch<SetStateAction<F>>
  roleAssignmentOptions: RoleAssignmentOption[]
  safetyOperationalAreas: readonly string[]
  /** e.g. `user` → ids like `user-safety-area`; `add-user` → `add-user-safety-area` */
  idPrefix: string
  /** Smaller typography and tighter list (add-user dialog) */
  compact?: boolean
}

export const UserRoleFields = <F extends SharedRoleFormFields>({
  form,
  setForm,
  roleAssignmentOptions,
  safetyOperationalAreas,
  idPrefix,
  compact = false,
}: UserRoleFieldsProps<F>) => {
  const labelClass = compact ? 'text-xs' : undefined
  const listMax = compact ? 'max-h-36' : 'max-h-52'
  const triggerClass = compact ? 'h-9' : undefined
  const roleCheckboxClass = compact
    ? 'size-3.5 shrink-0 rounded border-input'
    : 'mt-0.5 rounded border-input'

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="space-y-2">
        <Label className={labelClass}>Roles (at least one)</Label>
        <p className={compact ? 'text-[11px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
          From the department role catalog (Admin → Department roles).
        </p>
        <div
          className={`${listMax} space-y-2 overflow-y-auto rounded-md border p-3`}
          role="group"
          aria-label="User roles from catalog"
        >
          {roleAssignmentOptions.length === 0 ? (
            <p className={compact ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>
              No catalog roles. Add entries under Department roles.
            </p>
          ) : (
            <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
              {roleAssignmentOptions.map((opt) => (
                <li key={opt.id}>
                  <label
                    className={
                      compact
                        ? 'flex cursor-pointer items-center gap-2 text-sm leading-tight'
                        : 'flex cursor-pointer items-start gap-2 text-sm'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={form.roles.includes(opt.roleCode)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm((p) => ({
                            ...p,
                            roles: Array.from(new Set([...p.roles, opt.roleCode])),
                          }))
                        } else {
                          setForm((p) => {
                            const nextRoles = p.roles.filter((x) => x !== opt.roleCode)
                            return {
                              ...p,
                              roles: nextRoles,
                              ...(opt.roleCode === 'PILOT'
                                ? { pilotSeat: '' as const, pilotAircraftTypes: [] as string[] }
                                : {}),
                              ...(opt.roleCode === 'FLIGHT_DISPATCHERS'
                                ? { dispatcherAircraftTypes: [] as string[] }
                                : {}),
                            }
                          })
                        }
                      }}
                      className={roleCheckboxClass}
                      aria-label={`${opt.name}, ${opt.departmentName}, code ${opt.roleCode}`}
                    />
                    <span className={compact ? 'min-w-0' : undefined}>
                      <span className="font-medium">{opt.name}</span>
                      <span className="text-muted-foreground">
                        {compact ? ' · ' : ' — '}
                        {opt.departmentName}
                      </span>
                      {!compact && (
                        <span className="block font-mono text-xs text-muted-foreground">
                          {opt.roleCode}
                        </span>
                      )}
                      {compact && (
                        <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                          ({opt.roleCode})
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {form.roles.includes('SAFETY_OFFICER') && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-safety-area`} className={labelClass}>
            Safety operational area *
          </Label>
          <Select
            value={form.safetyOperationalArea || '__none__'}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                safetyOperationalArea: v === '__none__' ? '' : v,
              }))
            }
          >
            <SelectTrigger
              id={`${idPrefix}-safety-area`}
              aria-label="Safety operational area"
              className={triggerClass}
            >
              <SelectValue placeholder="Select safety area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select area</SelectItem>
              {safetyOperationalAreas.map((area) => (
                <SelectItem key={area} value={area}>
                  {area.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {form.roles.includes('PILOT') && (
        <fieldset className={`rounded-md border p-3 ${compact ? 'space-y-2' : 'space-y-3'}`}>
          <legend className={`px-1 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
            Pilot details *
          </legend>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-pilot-seat`} className={labelClass}>
              Seat
            </Label>
            <Select
              value={form.pilotSeat || '__none__'}
              onValueChange={(v) =>
                setForm((p) => ({
                  ...p,
                  pilotSeat: v === '__none__' ? ('' as const) : (v as PilotSeat),
                }))
              }
            >
              <SelectTrigger
                id={`${idPrefix}-pilot-seat`}
                aria-label="Pilot seat"
                className={triggerClass}
              >
                <SelectValue placeholder="Captain or First Officer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select seat</SelectItem>
                <SelectItem value="CAPTAIN">Captain</SelectItem>
                <SelectItem value="FIRST_OFFICER">First Officer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2" role="group" aria-label="Pilot aircraft types">
            <Label className={labelClass}>Aircraft types *</Label>
            <div className={compact ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-3'}>
              {AIRCRAFT_TYPE_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}
                >
                  <input
                    type="checkbox"
                    checked={form.pilotAircraftTypes.includes(value)}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setForm((p) => ({
                        ...p,
                        pilotAircraftTypes: checked
                          ? Array.from(new Set([...p.pilotAircraftTypes, value]))
                          : p.pilotAircraftTypes.filter((x) => x !== value),
                      }))
                    }}
                    className={compact ? 'size-3.5 rounded border-input' : 'rounded border-input'}
                    aria-label={`Pilot qualified on ${label}`}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      )}

      {form.roles.includes('FLIGHT_DISPATCHERS') && (
        <fieldset className="space-y-2 rounded-md border p-3">
          <legend className={`px-1 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
            Flight dispatcher — aircraft types *
          </legend>
          <div
            className={compact ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-3'}
            role="group"
            aria-label="Dispatcher aircraft types"
          >
            {AIRCRAFT_TYPE_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}
              >
                <input
                  type="checkbox"
                  checked={form.dispatcherAircraftTypes.includes(value)}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setForm((p) => ({
                      ...p,
                      dispatcherAircraftTypes: checked
                        ? Array.from(new Set([...p.dispatcherAircraftTypes, value]))
                        : p.dispatcherAircraftTypes.filter((x) => x !== value),
                    }))
                  }}
                  className={compact ? 'size-3.5 rounded border-input' : 'rounded border-input'}
                  aria-label={`Dispatcher for ${label}`}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  )
}
