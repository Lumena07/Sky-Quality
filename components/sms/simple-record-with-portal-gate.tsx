'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SimpleRecordPage, type FieldDef } from '@/components/sms/simple-record-page'
import { canApproveSmsPolicy, canManageSmsPolicy } from '@/lib/sms-permissions'

export type SimpleRecordPortalGate = 'policy' | 'communications' | 'training'

const roleAllowsCreateForGate = (gate: SimpleRecordPortalGate, roles: string[]): boolean => {
  if (gate === 'policy') {
    return canManageSmsPolicy(roles) || canApproveSmsPolicy(roles)
  }
  if (gate === 'communications') {
    return canManageSmsPolicy(roles)
  }
  return canManageSmsPolicy(roles) || roles.includes('DEPARTMENT_HEAD')
}

export const SimpleRecordWithPortalGate = ({
  portalGate,
  title,
  endpoint,
  fields,
}: {
  portalGate: SimpleRecordPortalGate
  title: string
  endpoint: string
  fields: FieldDef[]
}) => {
  const searchParams = useSearchParams()
  const [roles, setRoles] = useState<string[] | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (!res.ok) {
          setRoles([])
          return
        }
        const me = await res.json()
        setRoles(Array.isArray(me.roles) ? me.roles : [])
      } catch {
        setRoles([])
      }
    }
    run()
  }, [])

  const fromMySafety = searchParams.get('from') === 'my-safety'

  if (roles === null) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const showCreateForm = roleAllowsCreateForGate(portalGate, roles) && !fromMySafety

  const resolvedEndpoint =
    portalGate === 'training' && fromMySafety
      ? `${endpoint}?portal=my-safety`
      : endpoint

  return (
    <SimpleRecordPage
      title={title}
      endpoint={resolvedEndpoint}
      fields={fields}
      viewOnly={!showCreateForm}
    />
  )
}
