'use client'

import { cn } from '@/lib/utils'
import {
  type HazardLike,
  LIKELIHOOD_LABELS,
  SEVERITY_LABELS,
  hazardPlotCoords,
  riskIndexToLevel,
  riskLevelBand,
} from '@/lib/sms-risk-constants'

export type RiskMatrixHazard = HazardLike & { id: string }

export type RiskMatrixBand = 'ACCEPTABLE' | 'ALARP' | 'UNACCEPTABLE'

type RiskMatrixProps = {
  hazards: RiskMatrixHazard[]
  selectedBand: RiskMatrixBand | null
  onBandSelect: (band: RiskMatrixBand | null) => void
  className?: string
}

const cellBg = (likelihood: number, severity: number) => {
  const level = riskIndexToLevel(likelihood * severity)
  const band = riskLevelBand(level)
  if (band === 'green') return 'bg-emerald-600/85 hover:bg-emerald-600'
  if (band === 'amber') return 'bg-amber-500/85 hover:bg-amber-500'
  return 'bg-red-600/85 hover:bg-red-600'
}

export const RiskMatrix = ({
  hazards,
  selectedBand,
  onBandSelect,
  className,
}: RiskMatrixProps) => {
  const counts = new Map<string, number>()
  for (const h of hazards) {
    const { L, S } = hazardPlotCoords(h)
    const key = `${L}-${S}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent, L: number, S: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const band = riskIndexToLevel(L * S)
      const isSelected = selectedBand === band
      onBandSelect(isSelected ? null : band)
    }
  }

  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <p className="mb-3 text-sm font-medium text-foreground">ICAO-style 5×5 risk matrix (current assessment)</p>
      <div className="inline-block min-w-full overflow-x-auto">
        <table className="border-collapse text-center text-xs sm:text-sm" role="grid" aria-label="Risk matrix likelihood versus severity">
          <thead>
            <tr>
              <th className="p-1 sm:p-2" scope="col" />
              {([1, 2, 3, 4, 5] as const).map((L) => (
                <th key={L} className="p-1 sm:p-2 font-medium text-muted-foreground" scope="col">
                  L{L}
                  <span className="sr-only"> {LIKELIHOOD_LABELS[L]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((S) => (
              <tr key={S}>
                <th className="whitespace-nowrap p-1 text-left font-medium text-muted-foreground sm:p-2" scope="row">
                  S{S}
                  <span className="sr-only"> {SEVERITY_LABELS[S]}</span>
                </th>
                {([1, 2, 3, 4, 5] as const).map((L) => {
                  const key = `${L}-${S}`
                  const n = counts.get(key) ?? 0
                  const cellBand = riskIndexToLevel(L * S)
                  const selected = selectedBand != null && selectedBand === cellBand
                  return (
                    <td key={key} className="p-0.5 sm:p-1">
                      <button
                        type="button"
                        className={cn(
                          'relative flex h-12 w-12 sm:h-14 sm:w-16 flex-col items-center justify-center rounded-md text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          cellBg(L, S),
                          selected && 'ring-2 ring-white ring-offset-2 ring-offset-background'
                        )}
                        aria-label={`Likelihood ${L}, Severity ${S}, risk band ${cellBand}, ${n} hazard(s) in this cell. Click to filter register by this risk band.`}
                        aria-pressed={selected}
                        tabIndex={0}
                        onClick={() => {
                          const isSelected = selectedBand === cellBand
                          onBandSelect(isSelected ? null : cellBand)
                        }}
                        onKeyDown={(e) => handleKeyDown(e, L, S)}
                      >
                        <span className="text-lg font-semibold sm:text-xl">{n > 0 ? n : '·'}</span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Likelihood increases left to right; severity increases top to bottom. Click any cell to filter the register to
        hazards in that risk band (green = acceptable, amber = ALARP, red = unacceptable). Click again to clear.
      </p>
    </div>
  )
}
