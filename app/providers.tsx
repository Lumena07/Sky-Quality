'use client'

import dynamic from 'next/dynamic'

const SessionSync = dynamic(
  () => import('@/components/auth/session-sync').then((mod) => mod.SessionSync),
  { ssr: false }
)

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SessionSync />
      {children}
    </>
  )
}
