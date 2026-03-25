import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SmsPromotionRecordsPage = () => (
  <div className="space-y-4 p-6">
    <Card>
      <CardHeader>
        <CardTitle>Safety Promotion Records</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        This page aggregates promotion evidence. Current MVP data is available from:
        `/api/sms/communications`, `/api/sms/training`, `/api/sms/lessons`, and `/api/sms/surveys`.
      </CardContent>
    </Card>
  </div>
)

export default SmsPromotionRecordsPage
