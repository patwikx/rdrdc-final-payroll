import { NextRequest } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db"
import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { authenticateCredentials } from "@/modules/auth/utils/credentials-auth"
import { mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { issueMobileTokens } from "@/modules/auth/utils/mobile-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const loginSchema = z.object({
  identifier: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  password: z.string().min(1),
  companyId: z.string().uuid().optional(),
})

const toFailureMessage = (reason: string): string => {
  if (reason === "NO_ACTIVE_COMPANY_ACCESS") {
    return "No active company access found for this account."
  }
  return "Invalid credentials."
}

const safeAudit = async (input: Parameters<typeof createAuditLog>[0]) => {
  try {
    await createAuditLog(input)
  } catch (error) {
    console.error("Failed to create mobile auth audit log:", error)
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return mobileError("Invalid JSON payload.", 400)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Invalid login payload.", 400)
  }

  const identifier = parsed.data.identifier?.trim() || parsed.data.email?.trim() || ""
  if (!identifier) {
    return mobileError("identifier or email is required.", 400)
  }

  const authResult = await authenticateCredentials({
    identifier,
    password: parsed.data.password,
    requestedCompanyId: parsed.data.companyId ?? null,
  })

  if (!authResult.ok) {
    await safeAudit({
      tableName: "MobileAuthSession",
      recordId: `identifier:${identifier}`,
      action: "UPDATE",
      reason: `MOBILE_LOGIN_${authResult.reason}`,
      ...getRequestAuditMetadata(request),
      changes: [
        {
          fieldName: "authEvent",
          oldValue: "ANONYMOUS",
          newValue: "LOGIN_FAILED",
        },
      ],
    })

    return mobileError(toFailureMessage(authResult.reason), 401)
  }

  const now = new Date()
  await db.user.update({
    where: { id: authResult.user.id },
    data: { lastLoginAt: now },
  })

  await safeAudit({
    tableName: "MobileAuthSession",
    recordId: authResult.user.id,
    action: "UPDATE",
    userId: authResult.user.id,
    reason: "MOBILE_LOGIN_SUCCESS",
    ...getRequestAuditMetadata(request),
    changes: [
      {
        fieldName: "authEvent",
        oldValue: "ANONYMOUS",
        newValue: "LOGIN_SUCCESS",
      },
      {
        fieldName: "lastLoginAt",
        oldValue: authResult.user.lastLoginAt,
        newValue: now,
      },
    ],
  })

  const tokenSet = issueMobileTokens(authResult.user)

  return mobileOk(
    {
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      userId: authResult.user.id,
      companyId: authResult.user.companyId,
      role: authResult.user.role,
      companyRole: authResult.user.companyRole,
      employeeId: authResult.user.employeeId,
      employeeNumber: authResult.user.employeeNumber,
      expiresInSeconds: tokenSet.expiresInSeconds,
    },
    "Login successful."
  )
}
