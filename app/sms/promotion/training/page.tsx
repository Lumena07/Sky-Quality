import { Suspense } from 'react'
import { SimpleRecordWithPortalGate } from '@/components/sms/simple-record-with-portal-gate'

const loadingFallback = (
  <div className="space-y-4 p-6">
    <p className="text-sm text-muted-foreground">Loading...</p>
  </div>
)

const SmsTrainingPage = () => (
  <Suspense fallback={loadingFallback}>
    <SimpleRecordWithPortalGate
      portalGate="training"
      title="SMS Staff Training"
      endpoint="/api/sms/training"
      fields={[
        { key: 'userId', label: 'Staff User ID', required: true },
        { key: 'trainingType', label: 'Training Type', required: true },
        { key: 'deliveryMethod', label: 'Delivery Method' },
        { key: 'completedAt', label: 'Completed Date', type: 'date' },
        { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
        { key: 'certificateUrl', label: 'Certificate URL' },
      ]}
    />
  </Suspense>
)

export default SmsTrainingPage
