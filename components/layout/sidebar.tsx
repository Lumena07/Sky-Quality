'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const ROLES_STORAGE_KEY = 'sq_sidebar_roles'
const DEPT_STORAGE_KEY = 'sq_sidebar_departmentId'
const NAVIGATING_KEY = 'sq_sidebar_navigating'

import {
  LayoutDashboard,
  Calendar,
  CalendarCheck,
  AlertCircle,
  FileText,
  Settings,
  LogOut,
  ClipboardList,
  KeyRound,
  Shield,
  History,
  TrendingUp,
  BookOpen,
  Target,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebarRoles } from '@/components/providers/sidebar-roles-provider'
import { supabaseBrowserClient } from '@/lib/supabaseClient'
import { isAdminOrQM, isAuditorOnly, isNormalUser, isFocalPersonOnly, canSeeAmDashboard, isAccountableManager, canSeeTraining, canViewAuditPlan, canViewActivityLog } from '@/lib/permissions'

const amDashboardItem = { href: '/dashboard/am', label: 'AM Dashboard', icon: Shield }

const allMenuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/quality-policy', label: 'Quality Policy & Objectives', icon: Target },
  { href: '/audit-plan', label: 'Audit Plan', icon: CalendarCheck },
  { href: '/audits', label: 'Audits', icon: Calendar },
  { href: '/checklists', label: 'Checklists', icon: ClipboardList },
  { href: '/findings', label: 'Findings & CAP', icon: AlertCircle },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/training', label: 'Training', icon: BookOpen },
  { ...amDashboardItem },
  { href: '/dashboard/performance', label: 'Performance', icon: TrendingUp },
  { href: '/activity-log', label: 'Activity Log', icon: History },
  { href: '/admin', label: 'Admin', icon: Settings },
]

export const Sidebar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const { initialRoles: contextRoles, initialDepartmentId: contextDepartmentId } = useSidebarRoles()
  const [roles, setRoles] = useState<string[] | null>(contextRoles ?? null)
  const [departmentId, setDepartmentId] = useState<string | null>(contextDepartmentId ?? null)
  const [navigating, setNavigating] = useState(false)
  useEffect(() => {
    if (!pathname) return
    const id = setTimeout(() => setNavigating(false), 600)
    return () => clearTimeout(id)
  }, [pathname])

  const handleNavClick = () => {
    if (navigating) return
    try {
      sessionStorage.setItem(NAVIGATING_KEY, '1')
    } catch {
      // ignore
    }
    setNavigating(true)
  }

  useEffect(() => {
    try {
      const was = sessionStorage.getItem(NAVIGATING_KEY)
      if (was) {
        sessionStorage.removeItem(NAVIGATING_KEY)
        setNavigating(true)
      }
    } catch {
      // ignore
    }
    let cancelled = false
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          const newRoles = Array.isArray(data.roles) ? data.roles : []
          const newDept = data.departmentId ?? null
          setRoles(newRoles)
          setDepartmentId(newDept)
          try {
            sessionStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(newRoles))
            sessionStorage.setItem(DEPT_STORAGE_KEY, newDept ?? '')
          } catch {
            // ignore
          }
        } else {
          setRoles([])
          setDepartmentId(null)
        }
      } catch {
        if (!cancelled) {
          setRoles([])
          setDepartmentId(null)
        }
      }
    }
    fetchMe()
    return () => {
      cancelled = true
    }
  }, [])

  const menuItems = (() => {
    const normalUserItems = allMenuItems.filter((item) =>
      ['/dashboard', '/findings', '/documents', '/training', '/quality-policy'].includes(item.href)
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
      return isAccountableManager(roles)
        ? allMenuItems
        : allMenuItems.filter((item) => item.href !== '/dashboard/am')
    }
    if (isAuditorOnly(roles)) {
      return allMenuItems.filter((item) => item.href !== '/admin' && item.href !== '/dashboard/am')
    }
    if (canSeeAmDashboard(roles) && !isAdminOrQM(roles)) {
      const rest = allMenuItems.filter(
        (item) => item.href !== '/dashboard' && item.href !== '/dashboard/am' && item.href !== '/admin'
      )
      return [amDashboardItem, ...rest]
    }
    if (canSeeAmDashboard(roles)) {
      return allMenuItems.filter((item) => item.href !== '/admin')
    }
    if (isNormalUser(roles)) {
      return normalUserItems
    }
    return normalUserItems
  })().filter((item) => {
    if (item.href === '/audit-plan') return canViewAuditPlan(roles ?? [])
    if (item.href === '/activity-log') return canViewActivityLog(roles ?? [])
    if (item.href !== '/training') return true
    return canSeeTraining(roles ?? [], departmentId)
  })

  const handleSignOut = async () => {
    await supabaseBrowserClient.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Sky SQ QMS</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4" aria-busy={navigating}>
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname?.startsWith(item.href)
          const isAmDashboard = item.href === '/dashboard/am'
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => {
                if (navigating) {
                  e.preventDefault()
                  e.stopPropagation()
                  return
                }
                handleNavClick()
              }}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                navigating && 'cursor-not-allowed opacity-50'
              )}
              style={navigating ? { pointerEvents: 'none' } : undefined}
              aria-current={isActive ? 'page' : undefined}
              aria-label={isAmDashboard ? 'Accountable Manager Dashboard' : undefined}
              aria-disabled={navigating}
              tabIndex={navigating ? -1 : undefined}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4 space-y-1">
        <Link
          href="/user-guide"
          onClick={(e) => {
            if (navigating) {
              e.preventDefault()
              e.stopPropagation()
              return
            }
            handleNavClick()
          }}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname?.startsWith('/user-guide')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            navigating && 'cursor-not-allowed opacity-50'
          )}
          style={navigating ? { pointerEvents: 'none' } : undefined}
          aria-label="User guide"
          aria-disabled={navigating}
          tabIndex={navigating ? -1 : undefined}
        >
          <HelpCircle className="h-5 w-5" />
          User guide
        </Link>
        <Link
          href="/change-password"
          onClick={(e) => {
            if (navigating) {
              e.preventDefault()
              e.stopPropagation()
              return
            }
            handleNavClick()
          }}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname?.startsWith('/change-password')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            navigating && 'cursor-not-allowed opacity-50'
          )}
          style={navigating ? { pointerEvents: 'none' } : undefined}
          aria-disabled={navigating}
          tabIndex={navigating ? -1 : undefined}
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
