import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const { pathname } = request.nextUrl
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/audits') ||
    pathname.startsWith('/findings') ||
    pathname.startsWith('/documents') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/checklists') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/activity-log') ||
    pathname.startsWith('/training') ||
    pathname.startsWith('/change-password')

  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.cookies.get('sb-access-token')?.value

  if (isProtectedPath && !accessToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/audits/:path*', '/findings/:path*', '/documents/:path*', '/notifications/:path*', '/checklists/:path*', '/admin/:path*', '/activity-log', '/training', '/change-password'],
}
