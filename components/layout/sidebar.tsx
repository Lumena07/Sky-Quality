'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  AlertCircle,
  FileText,
  Settings,
  LogOut,
  ClipboardList,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabaseBrowserClient } from '@/lib/supabaseClient'
import { isAdminOrQM, isAuditorOnly, isNormalUser, isFocalPersonOnly } from '@/lib/permissions'

const allMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/audits', label: 'Audits', icon: Calendar },
  { href: '/checklists', label: 'Checklists', icon: ClipboardList },
  { href: '/findings', label: 'Findings & CAP', icon: AlertCircle },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/admin', label: 'Admin', icon: Settings },
]

export const Sidebar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const [roles, setRoles] = useState<string[] | null>(null)

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setRoles(Array.isArray(data.roles) ? data.roles : [])
        } else {
          setRoles([])
        }
      } catch {
        setRoles([])
      }
    }
    fetchMe()
  }, [])

  const menuItems = (() => {
    const normalUserItems = allMenuItems.filter((item) =>
      ['/dashboard', '/findings', '/documents'].includes(item.href)
    )
    const focalPersonItems = allMenuItems.filter((item) =>
      ['/dashboard', '/findings'].includes(item.href)
    )
    if (roles === null) {
      return normalUserItems
    }
    if (roles.length === 0) {
      return normalUserItems
    }
    if (isFocalPersonOnly(roles)) {
      return focalPersonItems
    }
    if (isAdminOrQM(roles)) {
      return allMenuItems
    }
    if (isAuditorOnly(roles)) {
      return allMenuItems.filter((item) => item.href !== '/admin')
    }
    if (isNormalUser(roles)) {
      return normalUserItems
    }
    return normalUserItems
  })()

  const handleSignOut = async () => {
    await supabaseBrowserClient.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Sky SQ QMS</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4 space-y-1">
        <Link
          href="/change-password"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname?.startsWith('/change-password')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <KeyRound className="h-5 w-5" />
          Change password
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
