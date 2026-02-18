import { NextRequest } from "next/server"

import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { getBearerToken, mobileOk } from "@/modules/auth/utils/mobile-api"
import { verifyMobileAccessToken } from "@/modules/auth/utils/mobile-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const safeAudit = async (input: Parameters<typeof createAuditLog>[0]) => {
  try {
    await createAuditLog(input)
  } catch (error) {
    console.error("Failed to create mobile logout audit log:", error)
  }
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request.headers.get("authorization"))
  const claims = token ? verifyMobileAccessToken(token) : null

  if (claims) {
    await safeAudit({
      tableName: "MobileAuthSession",
      recordId: claims.sub,
      action: "UPDATE",
      userId: claims.sub,
      reason: "MOBILE_LOGOUT",
      ...getRequestAuditMetadata(request),
      changes: [
        {
          fieldName: "authEvent",
          oldValue: "AUTHENTICATED",
          newValue: "LOGOUT",
        },
      ],
    })
  }

  return mobileOk(
    {
      revoked: false,
    },
    "Logged out."
  )
}
