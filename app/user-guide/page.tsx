'use client'

import { MainLayout } from '@/components/layout/main-layout'
import {
  USER_GUIDE_CONTENT,
  getUserGuideRoleId,
  type UserGuideRoleId,
} from '@/lib/user-guide-content'
import { useEffect, useState } from 'react'

const UserGuidePage = () => {
  const [roleId, setRoleId] = useState<UserGuideRoleId | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          const roles = Array.isArray(data.roles) ? data.roles : []
          setRoleId(getUserGuideRoleId(roles))
        } else {
          setRoleId('staffAndDeptHead')
        }
      } catch {
        if (!cancelled) setRoleId('staffAndDeptHead')
      }
    }
    fetchMe()
    return () => {
      cancelled = true
    }
  }, [])

  const resolvedRoleId: UserGuideRoleId = roleId ?? 'staffAndDeptHead'
  const content = USER_GUIDE_CONTENT[resolvedRoleId]

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-2">
          {content.title} User Guide
        </h1>
        {roleId === null ? (
          <p className="text-muted-foreground">Loading your guide…</p>
        ) : (
          <>
            <p className="text-muted-foreground mb-6">
              This guide explains how to navigate Sky SQ QMS in your role.
            </p>
            <section className="space-y-6">
              <section>
                <h2 className="text-lg font-semibold mb-2">Purpose</h2>
                <p className="text-muted-foreground text-sm">
                  {content.purpose}
                </p>
              </section>
              <section>
                <h2 className="text-lg font-semibold mb-2">Scope</h2>
                <p className="text-muted-foreground text-sm">
                  {content.scope}
                </p>
              </section>
              <section>
                <h2 className="text-lg font-semibold mb-3">Your menu</h2>
                <div className="space-y-6">
                  {content.menuSections.map((section, sectionIdx) => (
                    <div key={sectionIdx}>
                      <h3 className="text-base font-medium mb-2">
                        {section.sectionName}
                      </h3>
                      <ul className="list-none space-y-2" role="list">
                        {section.items.map((item, itemIdx) => (
                          <li
                            key={itemIdx}
                            className="flex flex-col gap-0.5 pl-0"
                          >
                            <span className="font-medium">{item.label}</span>
                            <span className="text-sm text-muted-foreground">
                              {item.description}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="text-lg font-semibold mb-3">
                  Where to go for common tasks
                </h2>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[320px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th
                          className="text-left font-medium p-3"
                          scope="col"
                        >
                          Task
                        </th>
                        <th
                          className="text-left font-medium p-3"
                          scope="col"
                        >
                          Go to
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.whereToGo.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b last:border-b-0 hover:bg-muted/30"
                        >
                          <td className="p-3 text-muted-foreground">
                            {row.task}
                          </td>
                          <td className="p-3 font-medium">{row.link}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  )
}

export default UserGuidePage
