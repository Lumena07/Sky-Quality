'use client'

import { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AuditCalendarProps {
  audits: any[]
  onDateClick?: (date: Date) => void
}

// Color palette for auditors (distinct colors)
const AUDITOR_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#A855F7', // violet
]

// Colors for audit types
const AUDIT_TYPE_COLORS = {
  INTERNAL: 'bg-blue-100 border-blue-300 hover:bg-blue-200',
  EXTERNAL: 'bg-orange-100 border-orange-300 hover:bg-orange-200',
  THIRD_PARTY: 'bg-purple-100 border-purple-300 hover:bg-purple-200',
  ERP: 'bg-green-100 border-green-300 hover:bg-green-200',
}

const AUDIT_TYPE_LABELS = {
  INTERNAL: 'Internal',
  EXTERNAL: 'External',
  THIRD_PARTY: '3rd Party',
  ERP: 'ERP',
}

export const AuditCalendar = ({ audits, onDateClick }: AuditCalendarProps) => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [auditors, setAuditors] = useState<any[]>([])

  useEffect(() => {
    const fetchAuditors = async () => {
      try {
        const res = await fetch('/api/auditors')
        if (res.ok) {
          const data = await res.json()
          setAuditors(data)
        }
      } catch (error) {
        console.error('Failed to fetch auditors:', error)
      }
    }
    fetchAuditors()
  }, [])

  const auditorColorMap = useMemo(() => {
    const map = new Map<string, string>()
    auditors.forEach((auditor, index) => {
      map.set(auditor.id, AUDITOR_COLORS[index % AUDITOR_COLORS.length])
    })
    return map
  }, [auditors])

  const getAuditTypeColor = (type: string) => {
    return AUDIT_TYPE_COLORS[type as keyof typeof AUDIT_TYPE_COLORS] || 'bg-gray-100 border-gray-300'
  }

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthDate = new Date(currentYear, i, 1)
      return {
        index: i,
        name: format(monthDate, 'MMM'),
        fullName: format(monthDate, 'MMMM'),
        daysInMonth: new Date(currentYear, i + 1, 0).getDate(),
      }
    })
  }, [currentYear])

  const getAuditsForDate = (day: number, monthIndex: number) => {
    const cellDate = new Date(currentYear, monthIndex, day)
    cellDate.setHours(0, 0, 0, 0)
    return audits.filter((audit) => {
      const start = audit.startDate ? new Date(audit.startDate) : new Date(audit.scheduledDate)
      const end = audit.endDate ? new Date(audit.endDate) : start
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return cellDate >= start && cellDate <= end
    })
  }

  const handleCellClick = (day: number, monthIndex: number) => {
    const date = new Date(currentYear, monthIndex, day)
    onDateClick?.(date)
  }

  const handlePreviousYear = () => {
    setCurrentYear((prev) => prev - 1)
  }

  const handleNextYear = () => {
    setCurrentYear((prev) => prev + 1)
  }

  const maxDays = 31

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Audit Calendar - {currentYear}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousYear}
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-20 text-center">{currentYear}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextYear}
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Auditors Legend */}
      {auditors.length > 0 && (
        <div className="p-4 border rounded-lg bg-muted/30">
          <h4 className="text-sm font-semibold mb-3">Auditors</h4>
          <div className="flex flex-wrap gap-3">
            {auditors.map((auditor) => {
              const color = auditorColorMap.get(auditor.id) || '#6B7280'
              return (
                <div
                  key={auditor.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <div
                    className="w-4 h-4 rounded border"
                    style={{
                      backgroundColor: color,
                      borderColor: color,
                    }}
                  />
                  <span>
                    {auditor.firstName} {auditor.lastName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Audit Types Legend */}
      <div className="p-4 border rounded-lg bg-muted/30">
        <h4 className="text-sm font-semibold mb-3">Audit Types</h4>
        <div className="flex flex-wrap gap-4">
          {Object.entries(AUDIT_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-2 text-sm">
              <div
                className={cn(
                  'w-4 h-4 rounded border',
                  getAuditTypeColor(type)
                )}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background border border-border p-2 text-left font-semibold text-sm min-w-[60px]">
                  Date
                </th>
                {months.map((month) => (
                  <th
                    key={month.index}
                    className="border border-border p-2 text-center font-semibold text-sm min-w-[120px] bg-muted/50"
                    title={month.fullName}
                  >
                    {month.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxDays }, (_, dayIndex) => {
                const day = dayIndex + 1
                return (
                  <tr key={day}>
                    <td className="sticky left-0 z-10 bg-background border border-border p-2 text-center font-medium text-sm">
                      {day}
                    </td>
                    {months.map((month) => {
                      const dayAudits = getAuditsForDate(day, month.index)
                      const isValidDate = day <= month.daysInMonth

                      return (
                        <td
                          key={`${month.index}-${day}`}
                          className={cn(
                            'border border-border p-1 align-top',
                            isValidDate
                              ? 'bg-background hover:bg-muted/50 cursor-pointer'
                              : 'bg-muted/20'
                          )}
                          onClick={() => isValidDate && handleCellClick(day, month.index)}
                          tabIndex={isValidDate ? 0 : -1}
                          onKeyDown={(e) => {
                            if (isValidDate && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault()
                              handleCellClick(day, month.index)
                            }
                          }}
                          aria-label={
                            isValidDate
                              ? `${day} ${month.fullName} - ${dayAudits.length} audit(s)`
                              : undefined
                          }
                        >
                          {isValidDate && dayAudits.length > 0 && (
                            <div className="space-y-1">
                              {dayAudits.slice(0, 3).map((audit) => {
                                const auditType = audit.type || 'INTERNAL'
                                const typeColor = getAuditTypeColor(auditType)
                                const auditors = audit.auditors || []
                                const auditorColors = auditors
                                  .map((a: any) => auditorColorMap.get(a.user?.id))
                                  .filter((color) => color !== undefined)

                                return (
                                  <div
                                    key={audit.id}
                                    className={cn(
                                      'text-xs p-1.5 rounded border cursor-pointer transition-colors',
                                      typeColor
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.location.href = `/audits/${audit.id}`
                                    }}
                                    title={audit.title}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="truncate font-medium text-[10px]">
                                        {audit.title.length > 15
                                          ? `${audit.title.substring(0, 15)}...`
                                          : audit.title}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1 py-0 h-4 shrink-0"
                                      >
                                        {audit.status}
                                      </Badge>
                                    </div>
                                    {auditorColors.length > 0 && (
                                      <div className="w-full h-1 rounded overflow-hidden flex gap-px">
                                        {auditorColors.map((color, idx) => (
                                          <div
                                            key={idx}
                                            className="flex-1 rounded"
                                            style={{ backgroundColor: color }}
                                            title={
                                              auditors[idx]?.user
                                                ? `${auditors[idx].user.firstName} ${auditors[idx].user.lastName}`
                                                : undefined
                                            }
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              {dayAudits.length > 3 && (
                                <div className="text-xs text-muted-foreground text-center p-1">
                                  +{dayAudits.length - 3} more
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
