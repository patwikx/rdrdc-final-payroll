import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse, type NextRequest } from "next/server"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { getRequiredRolesForCompanyPath, isCompanyRole } from "@/modules/navigation/sidebar-config"

const { auth } = NextAuth(authConfig)

// Extended user type from next-auth.d.ts
interface ExtendedUser {
  id?: string
  name?: string | null
  email?: string | null
  image?: string | null
  firstName?: string
  lastName?: string
  role?: string
  companyRole?: string | null
  defaultCompanyId?: string | null
  selectedCompanyId?: string | null
  employeeId?: string | null
  employeeNumber?: string | null
}

type AuthRequest = NextRequest & {
  auth?: {
    user?: unknown
  } | null
}

const getUserRole = (user: ExtendedUser | undefined): string => user?.companyRole ?? user?.role ?? "COMPANY_ADMIN"

const resolveUserHomePath = (user: ExtendedUser | undefined): string | null => {
  const companyId = user?.selectedCompanyId ?? user?.defaultCompanyId
  if (!companyId) {
    return null
  }

  return getUserRole(user) === "EMPLOYEE"
    ? `/${companyId}/employee-portal`
    : `/${companyId}/dashboard`
}

const isCompanyScopedRoute = (pathname: string, section: "dashboard" | "employee-portal"): boolean => {
  return new RegExp(`^/[^/]+/${section}(?:/.*)?$`).test(pathname)
}

const isAnyCompanyScopedPath = (pathname: string): boolean => {
  return /^\/[^/]+\/.+/.test(pathname)
}

export default auth((req: AuthRequest) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const isOnLogin = nextUrl.pathname.startsWith("/login")
  const isOnLogout = nextUrl.pathname.startsWith("/logout")
  const isOnRoot = nextUrl.pathname === "/"
  const isLegacyDashboardRoute = nextUrl.pathname === "/dashboard"
  
  const isDashboardRoute = isLegacyDashboardRoute || isCompanyScopedRoute(nextUrl.pathname, "dashboard")

  const isEmployeeRoute = isCompanyScopedRoute(nextUrl.pathname, "employee-portal")

  // Get user with proper typing
  const user = req.auth?.user as ExtendedUser | undefined
  const userRole = getUserRole(user)
  const homePath = resolveUserHomePath(user)

  if (isLoggedIn && !isCompanyRole(userRole)) {
    return NextResponse.redirect(new URL("/logout?reason=invalid-session", nextUrl))
  }

  const typedUserRole = userRole as CompanyRole

  // Keep logout route available to clear cookies/session
  if (isOnLogout) {
    return NextResponse.next()
  }

  // Invalidate malformed authenticated sessions
  if (isLoggedIn && (!user?.id || !homePath)) {
    return NextResponse.redirect(new URL("/logout?reason=invalid-session", nextUrl))
  }

  if ((isDashboardRoute || isEmployeeRoute) && !isLoggedIn) {
    const nextParam = `${nextUrl.pathname}${nextUrl.search}`
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("next", nextParam)
    return NextResponse.redirect(loginUrl)
  }

  if ((isOnRoot || isOnLogin) && isLoggedIn && homePath) {
    return NextResponse.redirect(new URL(homePath, nextUrl))
  }

  // Canonicalize legacy /dashboard to company-scoped dashboard
  if (isLegacyDashboardRoute && isLoggedIn && homePath) {
    return NextResponse.redirect(new URL(homePath, nextUrl))
  }

  // Enforce employee-only workspace to employee portal routes
  if (isLoggedIn && typedUserRole === "EMPLOYEE" && isAnyCompanyScopedPath(nextUrl.pathname) && !isEmployeeRoute) {
    return NextResponse.redirect(new URL(homePath ?? "/logout?reason=invalid-session", nextUrl))
  }

  if (isLoggedIn && isAnyCompanyScopedPath(nextUrl.pathname) && homePath) {
    const requiredRoles = getRequiredRolesForCompanyPath(nextUrl.pathname)

    if (requiredRoles && !requiredRoles.includes(typedUserRole)) {
      return NextResponse.redirect(new URL(homePath, nextUrl))
    }
  }
  
  return NextResponse.next()
})

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
