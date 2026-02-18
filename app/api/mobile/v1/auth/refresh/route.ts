import { NextRequest } from "next/server"
import { z } from "zod"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { getUserSessionForCompany } from "@/modules/auth/utils/credentials-auth"
import { mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { issueMobileTokens, verifyMobileRefreshToken } from "@/modules/auth/utils/mobile-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const safeAudit = async (input: Parameters<typeof createAuditLog>[0]) => {
  try {
    await createAuditLog(input)
  } catch (error) {
    console.error("Failed to create mobile refresh audit log:", error)
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return mobileError("Invalid JSON payload.", 400)
  }

  const parsed = refreshSchema.safeParse(body)
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Invalid refresh payload.", 400)
  }

  const claims = verifyMobileRefreshToken(parsed.data.refreshToken)
  if (!claims) {
    return mobileError("Invalid or expired refresh token.", 401)
  }

  const user = await getUserSessionForCompany({
    userId: claims.sub,
    companyId: claims.companyId,
  })

  if (!user) {
    await safeAudit({
      tableName: "MobileAuthSession",
      recordId: claims.sub,
      action: "UPDATE",
      userId: claims.sub,
      reason: "MOBILE_REFRESH_USER_INVALID",
      ...getRequestAuditMetadata(request),
      changes: [
        {
          fieldName: "authEvent",
          oldValue: "TOKEN_REFRESH",
          newValue: "TOKEN_REFRESH_REJECTED",
        },
      ],
    })
    return mobileError("Session is no longer valid.", 401)
  }

  const tokenSet = issueMobileTokens(user)

  await safeAudit({
    tableName: "MobileAuthSession",
    recordId: user.id,
    action: "UPDATE",
    userId: user.id,
    reason: "MOBILE_REFRESH_SUCCESS",
    ...getRequestAuditMetadata(request),
    changes: [
      {
        fieldName: "authEvent",
        oldValue: "TOKEN_REFRESH",
        newValue: "TOKEN_REFRESH_SUCCESS",
      },
    ],
  })

  return mobileOk(
    {
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      companyRole: user.companyRole,
      employeeId: user.employeeId,
      employeeNumber: user.employeeNumber,
      expiresInSeconds: tokenSet.expiresInSeconds,
    },
    "Token refreshed."
  )
}
