'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { FindingClassificationsContent } from '@/components/admin/finding-classifications-content'

const AdminFindingClassificationsPage = () => {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        if (!res.ok) {
          setAllowed(false)
          return
        }
        const data = await res.json()
        if (!Array.isArray(data.roles) || !data.roles.includes('QUALITY_MANAGER')) {
          router.replace('/admin')
          return
        }
        setAllowed(true)
      } catch {
        setAllowed(false)
      }
    }
    check()
  }, [router])

  if (allowed === null || allowed === false) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground" aria-label="Back to Admin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Finding Classifications</h1>
            <p className="text-muted-foreground mt-1">Aviation taxonomy by domain; used in finding form and repeat-finding KPI</p>
          </div>
        </div>
        <FindingClassificationsContent />
      </div>
    </MainLayout>
  )
}

export default AdminFindingClassificationsPage
