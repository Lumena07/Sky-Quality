import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SmsCampaignsPage = () => (
  <div className="p-6">
    <Card>
      <CardHeader>
        <CardTitle>Safety Awareness Campaigns</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Campaign data model is in place (`sms_campaigns`). UI management can now be added on this route.
      </CardContent>
    </Card>
  </div>
)

export default SmsCampaignsPage
