'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationsCard } from '@/components/dashboard/notifications-card'

type DashboardData = {
  openHazards: number
  openInvestigations: number
  openCapas: number
  newReports: number
  currentTrainingRecords: number
}

const SmsDashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [welcomeName, setWelcomeName] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const res = await fetch('/api/sms/dashboard', { credentials: 'same-origin' })
      if (!res.ok) return
      setData(await res.json())
    }
    run()
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (!res.ok) return
        const me = await res.json()
        const fromProfile = [me.firstName, me.lastName].filter(Boolean).join(' ').trim()
        setWelcomeName(fromProfile || me.email || null)
      } catch {
        setWelcomeName(null)
      }
    }
    run()
  }, [])

  const cards = [
    { label: 'Open Hazards', value: data?.openHazards ?? 0 },
    { label: 'Open Investigations', value: data?.openInvestigations ?? 0 },
    { label: 'Open CAPAs', value: data?.openCapas ?? 0 },
    { label: 'New Reports', value: data?.newReports ?? 0 },
    { label: 'Current Training Records', value: data?.currentTrainingRecords ?? 0 },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Safety Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {welcomeName ?? 'User'}
        </p>
      </div>

      <div className="space-y-6">
        <NotificationsCard />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardHeader>
                <CardTitle className="text-base">{card.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{card.value}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SmsDashboardPage
