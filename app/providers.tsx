'use client'

import { SessionSync } from '@/components/auth/session-sync'

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SessionSync />
      {children}
    </>
  )
}
