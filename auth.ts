import NextAuth, { type User as NextAuthUser } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { z } from "zod"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"

type DbUser = Awaited<ReturnType<typeof db.user.findFirst>>

async function getUser(identifier: string): Promise<DbUser> {
  try {
    const user = await db.user.findFirst({ 
      where: { 
        OR: [
          { email: identifier },
          { username: identifier }
        ]
      } 
    })
    return user
  } catch (error) {
    console.error('Failed to fetch user:', error)
    throw new Error('Failed to fetch user.')
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
        const parsedCredentials = z
          .object({ identifier: z.string().min(1), password: z.string().min(6) })
          .safeParse(credentials)

        if (parsedCredentials.success) {
          const { identifier, password } = parsedCredentials.data
          const user = await getUser(identifier)
          if (!user || !user.isActive) {
            await createAuditLog({
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
            // Fetch default company access
            const companyAccess = await db.userCompanyAccess.findFirst({
                where: { userId: user.id, isDefault: true, isActive: true },
                include: { company: true }
            })

            if (!companyAccess && !user.isAdmin) {
              await createAuditLog({
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

            // Fetch employee record if user is an employee
            const employee = await db.employee.findUnique({
                where: { userId: user.id },
                select: { id: true, employeeNumber: true, companyId: true }
            })

            await db.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            })

            await createAuditLog({
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
                  newValue: new Date(),
                },
              ],
            })

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
              employeeNumber: employee?.employeeNumber || null
            }
          }

          await createAuditLog({
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
        
        console.log('Invalid credentials')
        return null
      },
    }),
  ],
})
