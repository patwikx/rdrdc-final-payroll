import type { NextAuthConfig } from "next-auth"
import type { Session } from "next-auth"
import type { JWT } from "next-auth/jwt"

type AuthorizedArgs = {
  auth: { user?: unknown } | null
  request: { nextUrl: URL }
}

type JwtUser = {
  id?: string
  role?: string
  companyRole?: string | null
  defaultCompanyId?: string | null
  selectedCompanyId?: string | null
  employeeId?: string | null
  employeeNumber?: string | null
  firstName?: string
  lastName?: string
  sessionIssuedAt?: number
}

type AuthorizedUser = {
  role?: string
  companyRole?: string | null
  defaultCompanyId?: string | null
  selectedCompanyId?: string | null
}

const resolveHomePath = (user: AuthorizedUser): string | null => {
  const companyId = user.selectedCompanyId ?? user.defaultCompanyId
  if (!companyId) {
    return null
  }

  const role = user.companyRole ?? user.role ?? "COMPANY_ADMIN"
  if (role === "EMPLOYEE") {
    return `/${companyId}/employee-portal`
  }

  return `/${companyId}/dashboard`
}
 
export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 60,
    updateAge: 5 * 60,
  },
  jwt: {
    maxAge: 30 * 60,
  },
  pages: {
    signIn: '/login',
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: JwtUser }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.companyRole = user.companyRole
        token.defaultCompanyId = user.defaultCompanyId
        token.selectedCompanyId = user.selectedCompanyId
        token.employeeId = user.employeeId
        token.employeeNumber = user.employeeNumber
        // The user object from authorize() should have firstName/lastName
        if (user.firstName && user.lastName) {
            token.name = `${user.firstName} ${user.lastName}`
        }
        token.sessionIssuedAt = Date.now()
      }

      if (!token.sessionIssuedAt) {
        token.sessionIssuedAt = Date.now()
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string
        if (token.name) session.user.name = token.name
        if (token.role) session.user.role = token.role as string
        if (token.companyRole !== undefined) {
            session.user.companyRole = token.companyRole as string | null
        }
        if (token.defaultCompanyId !== undefined) {
            session.user.defaultCompanyId = token.defaultCompanyId as string | null
        }
        if (token.selectedCompanyId !== undefined) {
            session.user.selectedCompanyId = token.selectedCompanyId as string | null
        }
        if (token.employeeId) {
            session.user.employeeId = token.employeeId as string
        }
        if (token.employeeNumber) {
            session.user.employeeNumber = token.employeeNumber as string
        }
        if (token.sessionIssuedAt) {
            session.user.sessionIssuedAt = token.sessionIssuedAt as number
        }
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }: AuthorizedArgs) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname
      const isOnDashboard = pathname === "/dashboard" || /^\/[^/]+\/dashboard(?:\/.*)?$/.test(pathname)
      const isOnEmployeePortal = /^\/[^/]+\/employee-portal(?:\/.*)?$/.test(pathname)
      const isOnLogin = nextUrl.pathname.startsWith('/login')

      if (isOnDashboard || isOnEmployeePortal) {
        if (isLoggedIn) return true
        return false // Redirect unauthenticated users to login page
      } 
      
      if (isOnLogin) {
          if (isLoggedIn) {
            const destination = resolveHomePath((auth?.user ?? {}) as AuthorizedUser)
            if (destination) {
              return Response.redirect(new URL(destination, nextUrl))
            }
          }
          return true
      }
      
      return true
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig
