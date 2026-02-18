import NextAuth, { type User as NextAuthUser } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { z } from "zod"
import { db } from "@/lib/db"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { authenticateCredentials } from "@/modules/auth/utils/credentials-auth"

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
            const authResult = await authenticateCredentials({
              identifier,
              password,
            })

            if (!authResult.ok) {
              const isInactive = authResult.reason === "USER_INACTIVE"
              const isNoAccess = authResult.reason === "NO_ACTIVE_COMPANY_ACCESS"
              await safeCreateAuditLog({
                tableName: "AuthSession",
                recordId: authResult.userId ?? `identifier:${identifier}`,
                action: "UPDATE",
                userId: authResult.userId ?? null,
                reason: isInactive
                  ? "LOGIN_BLOCKED_INACTIVE_USER"
                  : isNoAccess
                    ? "LOGIN_BLOCKED_NO_ACTIVE_COMPANY_ACCESS"
                    : authResult.reason === "BAD_PASSWORD"
                      ? "LOGIN_FAILED_BAD_PASSWORD"
                      : "LOGIN_FAILED_USER_NOT_FOUND",
                ...getRequestAuditMetadata(request),
                changes: [
                  {
                    fieldName: "authEvent",
                    oldValue: "ANONYMOUS",
                    newValue: isInactive || isNoAccess ? "LOGIN_BLOCKED" : "LOGIN_FAILED",
                  },
                ],
              })
              return null
            }

            const user = authResult.user
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
              companyRole: user.companyRole,
              defaultCompanyId: user.companyId,
              selectedCompanyId: user.companyId,
              employeeId: user.employeeId,
              employeeNumber: user.employeeNumber,
            }
          }
        } catch (error) {
          console.error("Credentials authorize error:", error)
        }

        return null
      },
    }),
  ],
})
