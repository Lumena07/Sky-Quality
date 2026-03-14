import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SidebarRolesProvider } from '@/components/providers/sidebar-roles-provider'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sky SQ - Quality Management System',
  description: 'Internal Quality Management System for Aviation Company',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let initialRoles: string[] | null = null
  let initialDepartmentId: string | null = null
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (!authError && user) {
      const { data: profile, error: profileError } = await supabase
        .from('User')
        .select('roles, role, departmentId')
        .eq('id', user.id)
        .single()
      if (!profileError && profile) {
        initialRoles =
          Array.isArray(profile.roles) && profile.roles.length > 0
            ? profile.roles
            : profile.role
              ? [profile.role]
              : []
        initialDepartmentId = profile.departmentId ?? null
      } else {
        initialRoles = []
      }
    }
  } catch (error) {
    console.error('RootLayout profile fetch:', error)
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <SidebarRolesProvider
            initialRoles={initialRoles}
            initialDepartmentId={initialDepartmentId}
          >
            {children}
          </SidebarRolesProvider>
        </Providers>
      </body>
    </html>
  )
}
