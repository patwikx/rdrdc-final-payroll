import type { NextRequest } from "next/server"

import { db } from "@/lib/db"
import { getUserSessionForCompany } from "@/modules/auth/utils/credentials-auth"
import { getBearerToken, mobileError } from "@/modules/auth/utils/mobile-api"
import { verifyMobileAccessToken, type MobileAccessTokenClaims } from "@/modules/auth/utils/mobile-token"

type MobileSessionUser = NonNullable<Awaited<ReturnType<typeof getUserSessionForCompany>>>

export type MobileEmployeeContext = {
  id: string
  companyId: string
}

export type MobileSessionContext = {
  user: MobileSessionUser
  claims: MobileAccessTokenClaims
}

export type MobileSessionResult =
  | { ok: true; context: MobileSessionContext }
  | { ok: false; response: ReturnType<typeof mobileError> }

export async function requireMobileSession(request: NextRequest): Promise<MobileSessionResult> {
  const token = getBearerToken(request.headers.get("authorization"))
  if (!token) {
    return { ok: false, response: mobileError("Missing bearer token.", 401) }
  }

  const claims = verifyMobileAccessToken(token)
  if (!claims) {
    return { ok: false, response: mobileError("Invalid or expired access token.", 401) }
  }

  const user = await getUserSessionForCompany({
    userId: claims.sub,
    companyId: claims.companyId,
  })
  if (!user) {
    return { ok: false, response: mobileError("Session is no longer valid.", 401) }
  }

  return {
    ok: true,
    context: {
      user,
      claims,
    },
  }
}

export async function getMobileEmployeeContext(params: {
  userId: string
  companyId: string
}): Promise<MobileEmployeeContext | null> {
  const employee = await db.employee.findFirst({
    where: {
      userId: params.userId,
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      companyId: true,
    },
  })

  return employee ?? null
}
