'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  History,
  KeyRound,
  LayoutDashboard,
  LineChart,
  LogOut,
  Megaphone,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Target,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabaseBrowserClient } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'
import {
  canAccessSmsModule,
  canApproveSmsPolicy,
  canManageSmsPolicy,
  canManageSmsRoles,
  canSeeSmsSafetyRegister,
  canViewSmsProtectedData,
  isAccountableManager,
  isAdminOrQM,
} from '@/lib/permissions'
import {
  canReadSmsDashboard,
  canSubmitSmsReport,
} from '@/lib/sms-permissions'

const ROLES_STORAGE_KEY = 'sq_sms_sidebar_roles'
const NAVIGATING_KEY = 'sq_sms_sidebar_navigating'

type NavLeaf = { type: 'link'; href: string; label: string; icon: LucideIcon }

type NavGroup = {
  type: 'group'
  id: string
  label: string
  icon: LucideIcon
  children: NavLeaf[]
}

type NavEntry = NavLeaf | NavGroup

const buildSmsNav = (roles: string[]): NavEntry[] => {
  const policyChildren: NavLeaf[] = []
  if (
    canManageSmsPolicy(roles) ||
    canApproveSmsPolicy(roles) ||
    canViewSmsProtectedData(roles)
  ) {
    policyChildren.push(
      { type: 'link', href: '/sms/policy/statement', label: 'Policy & objectives', icon: FileText },
      { type: 'link', href: '/sms/policy/documents', label: 'SMS documents', icon: FolderOpen },
      { type: 'link', href: '/sms/policy/erp', label: 'Emergency response plan', icon: Radio }
    )
  }
  if (canSeeSmsSafetyRegister(roles)) {
    policyChildren.push({
      type: 'link',
      href: '/sms/policy/personnel',
      label: 'Safety personnel',
      icon: Users,
    })
  }

  const riskChildren: NavLeaf[] = []
  if (canSubmitSmsReport(roles)) {
    riskChildren.push({
      type: 'link',
      href: '/sms/risk/report',
      label: 'Report hazard / occurrence',
      icon: Siren,
    })
  }
  const riskMgmt =
    canViewSmsProtectedData(roles) || isAccountableManager(roles) || isAdminOrQM(roles)
  if (riskMgmt) {
    riskChildren.push(
      { type: 'link', href: '/sms/risk/register', label: 'Safety risk register', icon: ClipboardList },
      { type: 'link', href: '/sms/risk/investigations', label: 'Investigations', icon: Search },
      { type: 'link', href: '/sms/risk/change', label: 'Change management', icon: RefreshCw },
      { type: 'link', href: '/sms/risk/capa', label: 'CAPA', icon: AlertCircle },
      { type: 'link', href: '/sms/risk/regulatory', label: 'Regulatory', icon: Building2 }
    )
  }

  const assuranceChildren: NavLeaf[] = []
  if (riskMgmt) {
    assuranceChildren.push(
      { type: 'link', href: '/sms/assurance/dashboard', label: 'Assurance dashboard', icon: BarChart3 },
      { type: 'link', href: '/sms/assurance/audits', label: 'SMS audits', icon: ClipboardList },
      { type: 'link', href: '/sms/assurance/meetings', label: 'Safety meetings', icon: Calendar }
    )
  }

  const promotionChildren: NavLeaf[] = []
  if (canAccessSmsModule(roles)) {
    promotionChildren.push(
      { type: 'link', href: '/sms/promotion/training', label: 'Training', icon: GraduationCap },
      { type: 'link', href: '/sms/promotion/surveys', label: 'Surveys', icon: LineChart },
      { type: 'link', href: '/sms/promotion/communications', label: 'Communications', icon: Megaphone },
      { type: 'link', href: '/sms/promotion/lessons', label: 'Lessons learned', icon: BookOpen },
      { type: 'link', href: '/sms/promotion/campaigns', label: 'Campaigns', icon: Target },
      { type: 'link', href: '/sms/promotion/records', label: 'Records', icon: Archive }
    )
  }

  const entries: NavEntry[] = []

  if (canReadSmsDashboard(roles)) {
    entries.push({
      type: 'link',
      href: '/sms/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    })
  }

  if (canAccessSmsModule(roles)) {
    entries.push({
      type: 'link',
      href: '/sms/my-safety',
      label: 'My Safety',
      icon: ShieldCheck,
    })
  }

  if (policyChildren.length > 0) {
    entries.push({
      type: 'group',
      id: 'sms-policy',
      label: 'Policy & planning',
      icon: FileText,
      children: policyChildren,
    })
  }

  if (riskChildren.length > 0) {
    entries.push({
      type: 'group',
      id: 'sms-risk',
      label: 'Safety risk',
      icon: Siren,
      children: riskChildren,
    })
  }

  if (assuranceChildren.length > 0) {
    entries.push({
      type: 'group',
      id: 'sms-assurance',
      label: 'Assurance',
      icon: BarChart3,
      children: assuranceChildren,
    })
  }

  if (promotionChildren.length > 0) {
    entries.push({
      type: 'group',
      id: 'sms-promotion',
      label: 'Promotion',
      icon: Megaphone,
      children: promotionChildren,
    })
  }

  if (canManageSmsRoles(roles)) {
    entries.push({
      type: 'link',
      href: '/sms/audit-log',
      label: 'SMS audit log',
      icon: History,
    })
  }

  return entries
}

export const SmsSidebar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const [roles, setRoles] = useState<string[] | null>(null)
  const [navigating, setNavigating] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const id = setTimeout(() => setNavigating(false), 600)
    return () => clearTimeout(id)
  }, [pathname])

  useEffect(() => {
    let cancelled = false
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          const newRoles = Array.isArray(data.roles) ? data.roles : []
          setRoles(newRoles)
          try {
            sessionStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(newRoles))
          } catch {
            // ignore
          }
        } else {
          setRoles([])
        }
      } catch {
        if (!cancelled) setRoles([])
      }
    }
    fetchMe()
    return () => {
      cancelled = true
    }
  }, [])

  const navEntries = useMemo(() => buildSmsNav(roles ?? []), [roles])

  useEffect(() => {
    const next: Record<string, boolean> = {}
    for (const entry of navEntries) {
      if (entry.type !== 'group') continue
      const hasActive = entry.children.some(
        (c) => pathname === c.href || pathname?.startsWith(`${c.href}/`)
      )
      next[entry.id] = hasActive
    }
    setOpenGroups((prev) => ({ ...prev, ...next }))
  }, [pathname, navEntries])

  const handleNavClick = () => {
    if (navigating) return
    try {
      sessionStorage.setItem(NAVIGATING_KEY, '1')
    } catch {
      // ignore
    }
    setNavigating(true)
  }

  const handleSignOut = async () => {
    await supabaseBrowserClient.auth.signOut()
    router.push('/login')
  }

  const handleToggleGroup = (id: string) => {
    if (navigating) return
    setOpenGroups((o) => ({ ...o, [id]: !o[id] }))
  }

  const handleGroupKeyDown = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggleGroup(id)
    }
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-4">
        <Link
          href="/sms/dashboard"
          className="flex min-w-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="SKYAERO SMS — go to safety dashboard"
        >
          <Image
            src="/logo.png"
            alt="SKYAERO Aviation Limited SMS"
            width={976}
            height={439}
            className="h-9 w-auto max-w-[220px] shrink-0 object-contain object-left"
            priority
            unoptimized
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-busy={navigating}>
        {navEntries.length === 0 && roles !== null ? (
          <p className="px-3 text-sm text-muted-foreground">No SMS menu items for your role.</p>
        ) : null}

        {navEntries.map((entry) => {
          if (entry.type === 'link') {
            const Icon = entry.icon
            const isActive = Boolean(pathname?.startsWith(entry.href))
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={(e) => {
                  if (navigating) {
                    e.preventDefault()
                    e.stopPropagation()
                  } else {
                    handleNavClick()
                  }
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
                aria-disabled={navigating}
                tabIndex={navigating ? -1 : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {entry.label}
              </Link>
            )
          }

          const GroupIcon = entry.icon
          const expanded = openGroups[entry.id] ?? false
          const groupActive = entry.children.some(
            (c) => pathname === c.href || pathname?.startsWith(`${c.href}/`)
          )

          return (
            <div key={entry.id} className="space-y-1">
              <button
                type="button"
                id={`${entry.id}-trigger`}
                aria-expanded={expanded}
                aria-controls={`${entry.id}-submenu`}
                disabled={navigating}
                onClick={() => handleToggleGroup(entry.id)}
                onKeyDown={handleGroupKeyDown(entry.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                  groupActive && !expanded ? 'bg-muted/80 text-foreground' : 'text-muted-foreground',
                  'hover:bg-accent hover:text-accent-foreground',
                  navigating && 'cursor-not-allowed opacity-50'
                )}
                aria-label={`${entry.label} submenu`}
              >
                <GroupIcon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="flex-1">{entry.label}</span>
              </button>
              {expanded ? (
                <div
                  id={`${entry.id}-submenu`}
                  role="group"
                  aria-labelledby={`${entry.id}-trigger`}
                  className="ml-1 space-y-0.5 border-l border-border pl-3"
                >
                  {entry.children.map((child) => {
                    const ChildIcon = child.icon
                    const childActive = Boolean(pathname?.startsWith(child.href))
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={(e) => {
                          if (navigating) {
                            e.preventDefault()
                            e.stopPropagation()
                          } else {
                            handleNavClick()
                          }
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                          childActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          navigating && 'cursor-not-allowed opacity-50'
                        )}
                        style={navigating ? { pointerEvents: 'none' } : undefined}
                        aria-current={childActive ? 'page' : undefined}
                        aria-disabled={navigating}
                        tabIndex={navigating ? -1 : undefined}
                      >
                        <ChildIcon className="h-4 w-4 shrink-0" />
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="space-y-1 border-t p-4">
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
        <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
