'use client'

import { createContext, useContext } from 'react'

export type SidebarRolesContextValue = {
  initialRoles: string[] | null
  initialDepartmentId: string | null
}

const SidebarRolesContext = createContext<SidebarRolesContextValue>({
  initialRoles: null,
  initialDepartmentId: null,
})

export const useSidebarRoles = () => useContext(SidebarRolesContext)

type SidebarRolesProviderProps = {
  initialRoles: string[] | null
  initialDepartmentId: string | null
  children: React.ReactNode
}

export const SidebarRolesProvider = ({
  initialRoles,
  initialDepartmentId,
  children,
}: SidebarRolesProviderProps) => {
  return (
    <SidebarRolesContext.Provider
      value={{ initialRoles, initialDepartmentId }}
    >
      {children}
    </SidebarRolesContext.Provider>
  )
}
