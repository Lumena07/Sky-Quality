import { Suspense } from 'react'
import { SimpleRecordWithPortalGate } from '@/components/sms/simple-record-with-portal-gate'

const loadingFallback = (
  <div className="space-y-4 p-6">
    <p className="text-sm text-muted-foreground">Loading...</p>
  </div>
)

const SmsCommunicationsPage = () => (
  <Suspense fallback={loadingFallback}>
    <SimpleRecordWithPortalGate
      portalGate="communications"
      title="Safety Communications"
      endpoint="/api/sms/communications"
      fields={[
        { key: 'communicationType', label: 'Communication Type', required: true },
        { key: 'subject', label: 'Subject', required: true },
        { key: 'body', label: 'Body', required: true, type: 'textarea' },
        { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
      ]}
    />
  </Suspense>
)

export default SmsCommunicationsPage
