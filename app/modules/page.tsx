import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ClipboardCheck, Shield } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import {
  canAccessQualityModule,
  canAccessSmsModule,
  getCurrentUserProfile,
  isDirectorOfSafety,
} from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const ModulesPage = async () => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/modules')
  }

  const profile = await getCurrentUserProfile(supabase, user.id)
  const { roles } = profile
  const qualityAllowed = canAccessQualityModule(roles)
  const smsAllowed = canAccessSmsModule(roles)
  const smsEntryHref = isDirectorOfSafety(roles) ? '/sms/assurance/dashboard' : '/sms/dashboard'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 gap-8">
      <Image
        src="/logo.png"
        alt="SKYAERO Aviation Limited — Safety and Quality System"
        width={976}
        height={439}
        className="w-full max-w-sm h-auto object-contain"
        priority
        unoptimized
      />
      <div className="w-full max-w-3xl space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Safety and Quality System</h1>
        <p className="text-muted-foreground text-sm">Choose a module to continue</p>
      </div>
      <div className="grid w-full max-w-3xl gap-6 md:grid-cols-2">
        <Card
          className={
            qualityAllowed ? 'border-border shadow-sm' : 'border-border opacity-60'
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 shrink-0 text-blue-600" aria-hidden />
              Quality module
            </CardTitle>
            <CardDescription>Audits, findings, documents, and quality programme</CardDescription>
          </CardHeader>
          <CardContent>
            {!qualityAllowed && (
              <p className="text-sm text-muted-foreground" role="status">
                You do not have permission to open this module. Contact your administrator if you need access.
              </p>
            )}
          </CardContent>
          <CardFooter>
            {qualityAllowed ? (
              <Button className="w-full" asChild>
                <Link href="/dashboard" aria-label="Open Quality module">
                  Open Quality module
                </Link>
              </Button>
            ) : (
              <Button type="button" className="w-full" disabled aria-disabled="true">
                Open Quality module
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card
          className={smsAllowed ? 'border-border shadow-sm' : 'border-border opacity-60'}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              Safety module (SMS)
            </CardTitle>
            <CardDescription>Safety reporting, policy, hazards, and assurance</CardDescription>
          </CardHeader>
          <CardContent>
            {!smsAllowed && (
              <p className="text-sm text-muted-foreground" role="status">
                You do not have permission to open this module. Contact your administrator if you need access.
              </p>
            )}
          </CardContent>
          <CardFooter>
            {smsAllowed ? (
              <Button className="w-full" asChild variant="secondary">
                <Link href={smsEntryHref} aria-label="Open Safety module SMS dashboard">
                  Open Safety module
                </Link>
              </Button>
            ) : (
              <Button type="button" className="w-full" variant="secondary" disabled aria-disabled="true">
                Open Safety module
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default ModulesPage
