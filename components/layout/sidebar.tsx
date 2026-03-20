'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

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
  Users,
  Layers,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebarRoles } from '@/components/providers/sidebar-roles-provider'
import { supabaseBrowserClient } from '@/lib/supabaseClient'
import {
  isAdminOrQM,
  isAuditorOnly,
  isNormalUser,
  isFocalPersonOnly,
  canSeeAmDashboard,
  isAccountableManager,
  canSeeTraining,
  canSeeQualityTeamRegister,
  canViewAuditPlan,
  canViewActivityLog,
} from '@/lib/permissions'

const amDashboardItem = { href: '/dashboard/am', label: 'AM Dashboard', icon: Shield }

/** Hrefs grouped under Quality Assurance (display order). */
const QUALITY_ASSURANCE_HREFS = [
  '/audit-plan',
  '/audits',
  '/findings',
  '/checklists',
] as const

const qualityAssuranceHrefSet = new Set<string>(QUALITY_ASSURANCE_HREFS)

type MenuLinkItem = {
  href: string
  label: string
  icon: LucideIcon
}

type SidebarNavEntry =
  | (MenuLinkItem & { type: 'link' })
  | {
      type: 'group'
      id: 'quality-assurance'
      label: string
      icon: LucideIcon
      children: MenuLinkItem[]
    }

const allMenuItems: MenuLinkItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/quality-policy', label: 'Quality Policy & Objectives', icon: Target },
  { href: '/quality-team', label: 'Quality team register', icon: Users },
  { href: '/audit-plan', label: 'Quality Programme', icon: CalendarCheck },
  { href: '/audits', label: 'Audits', icon: Calendar },
  { href: '/findings', label: 'Findings & CAP', icon: AlertCircle },
  { href: '/checklists', label: 'Checklists', icon: ClipboardList },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/training', label: 'Training & Qualification', icon: BookOpen },
  { ...amDashboardItem },
  { href: '/dashboard/performance', label: 'Performance', icon: TrendingUp },
  { href: '/activity-log', label: 'Activity Log', icon: History },
  { href: '/admin', label: 'Admin', icon: Settings },
]

const sortQualityAssuranceChildren = (children: MenuLinkItem[]): MenuLinkItem[] => {
  const order = [...QUALITY_ASSURANCE_HREFS]
  return [...children].sort(
    (a, b) => order.indexOf(a.href as (typeof order)[number]) - order.indexOf(b.href as (typeof order)[number])
  )
}

/** Collapse consecutive QA routes into one group (post role + permission filter). */
const foldQualityAssuranceGroup = (flat: MenuLinkItem[]): SidebarNavEntry[] => {
  const out: SidebarNavEntry[] = []
  let i = 0
  while (i < flat.length) {
    if (qualityAssuranceHrefSet.has(flat[i].href)) {
      const chunk: MenuLinkItem[] = []
      while (i < flat.length && qualityAssuranceHrefSet.has(flat[i].href)) {
        chunk.push(flat[i])
        i++
      }
      const children = sortQualityAssuranceChildren(chunk)
      if (children.length > 0) {
        out.push({
          type: 'group',
          id: 'quality-assurance',
          label: 'Quality Assurance',
          icon: Layers,
          children,
        })
      }
    } else {
      out.push({ type: 'link', ...flat[i] })
      i++
    }
  }
  return out
}

const getFilteredFlatMenu = (
  roles: string[] | null,
  departmentId: string | null
): MenuLinkItem[] => {
  const normalUserItems = allMenuItems.filter((item) =>
    ['/dashboard', '/findings', '/documents', '/training', '/quality-policy'].includes(item.href)
  )
  const focalPersonItems = allMenuItems.filter((item) =>
    ['/dashboard', '/findings'].includes(item.href)
  )

  let flat: MenuLinkItem[]
  if (roles === null || roles.length === 0) {
    flat = normalUserItems
  } else if (isFocalPersonOnly(roles)) {
    flat = focalPersonItems
  } else if (isAdminOrQM(roles)) {
    flat = isAccountableManager(roles)
      ? allMenuItems
      : allMenuItems.filter((item) => item.href !== '/dashboard/am')
  } else if (isAuditorOnly(roles)) {
    flat = allMenuItems.filter((item) => item.href !== '/admin' && item.href !== '/dashboard/am')
  } else if (canSeeAmDashboard(roles) && !isAdminOrQM(roles)) {
    const rest = allMenuItems.filter(
      (item) => item.href !== '/dashboard' && item.href !== '/dashboard/am' && item.href !== '/admin'
    )
    flat = [amDashboardItem, ...rest]
  } else if (canSeeAmDashboard(roles)) {
    flat = allMenuItems.filter((item) => item.href !== '/admin')
  } else if (isNormalUser(roles)) {
    flat = normalUserItems
  } else {
    flat = normalUserItems
  }

  return flat.filter((item) => {
    if (item.href === '/audit-plan') return canViewAuditPlan(roles ?? [])
    if (item.href === '/activity-log') return canViewActivityLog(roles ?? [])
    if (item.href === '/quality-team') return canSeeQualityTeamRegister(roles ?? [])
    if (item.href === '/training') return canSeeTraining(roles ?? [], departmentId)
    return true
  })
}

const QA_SUBMENU_ID = 'sidebar-quality-assurance-submenu'

export const Sidebar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const { initialRoles: contextRoles, initialDepartmentId: contextDepartmentId } = useSidebarRoles()
  const [roles, setRoles] = useState<string[] | null>(contextRoles ?? null)
  const [departmentId, setDepartmentId] = useState<string | null>(contextDepartmentId ?? null)
  const [navigating, setNavigating] = useState(false)
  const [qualityAssuranceOpen, setQualityAssuranceOpen] = useState(false)

  const navEntries = useMemo(
    () => foldQualityAssuranceGroup(getFilteredFlatMenu(roles, departmentId)),
    [roles, departmentId]
  )

  const isQualityAssurancePathActive = useMemo(
    () =>
      Boolean(pathname && QUALITY_ASSURANCE_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`))),
    [pathname]
  )

  useEffect(() => {
    if (!pathname) return
    const id = setTimeout(() => setNavigating(false), 600)
    return () => clearTimeout(id)
  }, [pathname])

  useEffect(() => {
    if (isQualityAssurancePathActive) {
      setQualityAssuranceOpen(true)
    }
  }, [isQualityAssurancePathActive])

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

  const handleToggleQualityAssurance = () => {
    if (navigating) return
    setQualityAssuranceOpen((o) => !o)
  }

  const handleQualityAssuranceKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggleQualityAssurance()
    }
  }

  const handleSignOut = async () => {
    await supabaseBrowserClient.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          aria-label="SKYAERO eQMS — go to dashboard"
        >
          <Image
            src="/logo.png"
            alt="SKYAERO Aviation Limited eQMS"
            width={976}
            height={439}
            className="h-9 w-auto max-w-[220px] shrink-0 object-contain object-left"
            priority
            unoptimized
          />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-busy={navigating}>
        {navEntries.map((entry) => {
          if (entry.type === 'link') {
            const Icon = entry.icon
            const isActive = Boolean(pathname?.startsWith(entry.href))
            const isAmDashboard = entry.href === '/dashboard/am'
            return (
              <Link
                key={entry.href}
                href={entry.href}
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
                <Icon className="h-5 w-5 shrink-0" />
                {entry.label}
              </Link>
            )
          }

          const GroupIcon = entry.icon
          const groupHasActiveChild = entry.children.some(
            (c) => pathname === c.href || pathname?.startsWith(`${c.href}/`)
          )

          return (
            <div key={entry.id} className="space-y-1">
              <button
                type="button"
                id={`${entry.id}-trigger`}
                aria-expanded={qualityAssuranceOpen}
                aria-controls={QA_SUBMENU_ID}
                disabled={navigating}
                onClick={handleToggleQualityAssurance}
                onKeyDown={handleQualityAssuranceKeyDown}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                  groupHasActiveChild && !qualityAssuranceOpen
                    ? 'bg-muted/80 text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  navigating && 'cursor-not-allowed opacity-50'
                )}
                aria-label="Quality Assurance submenu"
              >
                <GroupIcon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="flex-1">{entry.label}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform',
                    qualityAssuranceOpen && 'rotate-180'
                  )}
                  aria-hidden
                />
              </button>
              {qualityAssuranceOpen && (
                <div
                  id={QA_SUBMENU_ID}
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
                            return
                          }
                          handleNavClick()
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
              )}
            </div>
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
        <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
