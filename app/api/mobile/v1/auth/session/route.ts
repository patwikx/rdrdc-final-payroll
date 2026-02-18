import { NextRequest } from "next/server"

import { getUserSessionForCompany } from "@/modules/auth/utils/credentials-auth"
import { getBearerToken, mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { verifyMobileAccessToken } from "@/modules/auth/utils/mobile-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const token = getBearerToken(request.headers.get("authorization"))
  if (!token) {
    return mobileError("Missing bearer token.", 401)
  }

  const claims = verifyMobileAccessToken(token)
  if (!claims) {
    return mobileError("Invalid or expired access token.", 401)
  }

  const user = await getUserSessionForCompany({
    userId: claims.sub,
    companyId: claims.companyId,
  })
  if (!user) {
    return mobileError("Session is no longer valid.", 401)
  }

  return mobileOk({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isAdmin: user.isAdmin,
      companyRole: user.companyRole,
      companyId: user.companyId,
      employeeId: user.employeeId,
      employeeNumber: user.employeeNumber,
    },
    token: {
      issuedAt: claims.iat,
      expiresAt: claims.exp,
    },
  })
}
