'use client'

import { ModuleSwitcher } from '@/components/layout/module-switcher'
import { SmsSidebar } from '@/components/layout/sms-sidebar'

const SmsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen flex-col">
      <ModuleSwitcher />
      <div className="flex min-h-0 flex-1">
        <SmsSidebar />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  )
}

export default SmsLayout
