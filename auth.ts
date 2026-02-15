import NextAuth, { type User as NextAuthUser } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { z } from "zod"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"

type LoginUserRecord = Awaited<ReturnType<typeof getLoginUser>>

async function getLoginUser(identifier: string): Promise<{
  id: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  role: string
  isAdmin: boolean
  isActive: boolean
  lastLoginAt: Date | null
  companyAccess: Array<{
    companyId: string
    role: string
  }>
  employee: {
    id: string
    employeeNumber: string
    companyId: string
  } | null
} | null> {
  try {
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        isAdmin: true,
        isActive: true,
        lastLoginAt: true,
        companyAccess: {
          where: {
            isDefault: true,
            isActive: true,
          },
          orderBy: [{ createdAt: "asc" }],
          select: {
            companyId: true,
            role: true,
          },
          take: 1,
        },
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            companyId: true,
          },
        },
      },
    })
    return user
  } catch (error) {
    console.error("Failed to fetch user:", error)
    return null
  }
}

async function safeCreateAuditLog(input: Parameters<typeof createAuditLog>[0]): Promise<void> {
  try {
    await createAuditLog(input)
  } catch (error) {
    console.error("Failed to write auth audit log:", error)
  }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(
        credentials: Record<string, unknown> | undefined,
        request: Request
      ): Promise<NextAuthUser | null> {
        try {
          const parsedCredentials = z
            .object({ identifier: z.string().min(1), password: z.string().min(6) })
            .safeParse(credentials)

          if (parsedCredentials.success) {
            const { identifier, password } = parsedCredentials.data
            const user: LoginUserRecord = await getLoginUser(identifier)
            if (!user || !user.isActive) {
              await safeCreateAuditLog({
                tableName: "AuthSession",
                recordId: `identifier:${identifier}`,
                action: "UPDATE",
                reason: user ? "LOGIN_BLOCKED_INACTIVE_USER" : "LOGIN_FAILED_USER_NOT_FOUND",
                ...getRequestAuditMetadata(request),
                changes: [
                  {
                    fieldName: "authEvent",
                    oldValue: "ANONYMOUS",
                    newValue: user ? "LOGIN_BLOCKED" : "LOGIN_FAILED",
                  },
                ],
              })
              return null
            }

            const passwordsMatch = await bcrypt.compare(password, user.passwordHash)
            if (passwordsMatch) {
              const companyAccess = user.companyAccess[0] ?? null

              if (!companyAccess && !user.isAdmin) {
                await safeCreateAuditLog({
                  tableName: "AuthSession",
                  recordId: user.id,
                  action: "UPDATE",
                  userId: user.id,
                  reason: "LOGIN_BLOCKED_NO_ACTIVE_COMPANY_ACCESS",
                  ...getRequestAuditMetadata(request),
                  changes: [
                    {
                      fieldName: "authEvent",
                      oldValue: "AUTHENTICATED",
                      newValue: "LOGIN_BLOCKED",
                    },
                  ],
                })
                return null
              }

              const employee = user.employee
              const now = new Date()

              await Promise.all([
                db.user.update({
                  where: { id: user.id },
                  data: { lastLoginAt: now },
                }),
                safeCreateAuditLog({
                  tableName: "AuthSession",
                  recordId: user.id,
                  action: "UPDATE",
                  userId: user.id,
                  reason: "LOGIN_SUCCESS",
                  ...getRequestAuditMetadata(request),
                  changes: [
                    {
                      fieldName: "authEvent",
                      oldValue: "ANONYMOUS",
                      newValue: "LOGIN_SUCCESS",
                    },
                    {
                      fieldName: "lastLoginAt",
                      oldValue: user.lastLoginAt,
                      newValue: now,
                    },
                  ],
                }),
              ])

              return {
                id: user.id,
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isAdmin: user.isAdmin,
                companyRole: companyAccess?.role ?? null,
                defaultCompanyId: companyAccess?.companyId || employee?.companyId || null,
                selectedCompanyId: companyAccess?.companyId ?? employee?.companyId ?? null,
                employeeId: employee?.id || null,
                employeeNumber: employee?.employeeNumber || null,
              }
            }

            await safeCreateAuditLog({
              tableName: "AuthSession",
              recordId: user.id,
              action: "UPDATE",
              userId: user.id,
              reason: "LOGIN_FAILED_BAD_PASSWORD",
              ...getRequestAuditMetadata(request),
              changes: [
                {
                  fieldName: "authEvent",
                  oldValue: "ANONYMOUS",
                  newValue: "LOGIN_FAILED",
                },
              ],
            })
          }
        } catch (error) {
          console.error("Credentials authorize error:", error)
        }

        return null
      },
    }),
  ],
})
