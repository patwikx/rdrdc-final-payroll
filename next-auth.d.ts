import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string
      firstName?: string
      lastName?: string
      role?: string
      isAdmin?: boolean
      companyRole?: string | null
      defaultCompanyId?: string | null
      selectedCompanyId?: string | null
      employeeId?: string | null
      employeeNumber?: string | null
      sessionIssuedAt?: number
    } & DefaultSession["user"]
  }

  interface User {
      firstName?: string
      lastName?: string
      role?: string
      isAdmin?: boolean
      companyRole?: string | null
      defaultCompanyId?: string | null
      selectedCompanyId?: string | null
      employeeId?: string | null
      employeeNumber?: string | null
      sessionIssuedAt?: number
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id?: string
    firstName?: string
    lastName?: string
    role?: string
    isAdmin?: boolean
    companyRole?: string | null
    defaultCompanyId?: string | null
    selectedCompanyId?: string | null
    employeeId?: string | null
    employeeNumber?: string | null
    sessionIssuedAt?: number
  }
}
