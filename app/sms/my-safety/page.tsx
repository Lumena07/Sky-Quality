import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const MySafetyPage = () => {
  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>My Safety Portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Quick access to reporting, policy, communications, and training.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/sms/risk/report">Submit Hazard / Occurrence</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sms/policy/statement?from=my-safety">Safety Policy</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sms/policy/documents?from=my-safety">SMS documents (all staff)</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sms/policy/erp?from=my-safety">Emergency Response Plan</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sms/promotion/communications?from=my-safety">Safety Noticeboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sms/promotion/training?from=my-safety">Training Records</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default MySafetyPage
