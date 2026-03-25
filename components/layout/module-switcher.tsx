'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const QMS_ENTRY_HREF = '/dashboard'
const SMS_ENTRY_HREF = '/sms/dashboard'

export const ModuleSwitcher = () => {
  const pathname = usePathname()
  const isSmsModule = Boolean(pathname?.startsWith('/sms'))
  const isQmsModule = !isSmsModule

  return (
    <nav
      aria-label="Application modules"
      className="flex h-12 shrink-0 items-center gap-1 border-b bg-card px-4"
    >
      <Link
        href={QMS_ENTRY_HREF}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isQmsModule
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        aria-current={isQmsModule ? 'page' : undefined}
      >
        QMS
      </Link>
      <Link
        href={SMS_ENTRY_HREF}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isSmsModule
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        aria-current={isSmsModule ? 'page' : undefined}
      >
        SMS
      </Link>
    </nav>
  )
}
