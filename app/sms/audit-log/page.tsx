'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SmsAuditLogPage = () => {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    const run = async () => {
      const res = await fetch('/api/sms/audit-log', { credentials: 'same-origin' })
      if (!res.ok) return
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    }
    run()
  }, [])

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>SMS Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(logs, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

export default SmsAuditLogPage
