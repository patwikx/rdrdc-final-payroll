import { NextRequest } from "next/server"
import { z } from "zod"

import { requireMobileSession } from "@/modules/auth/utils/mobile-session"
import { mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { cancelOvertimeRequestAction } from "@/modules/employee-portal/actions/overtime-request-actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const cancelPayloadSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
})

const resolveCompanyId = (companyId: string | null | undefined, fallback: string): string => companyId ?? fallback

type RouteContext = {
  params: Promise<{ requestId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await requireMobileSession(request)
  if (!session.ok) {
    return session.response
  }

  const companyRole = session.context.user.companyRole
  if (companyRole !== "EMPLOYEE") {
    return mobileError("Only employees can cancel overtime requests in mobile portal.", 403)
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = cancelPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Invalid overtime cancellation payload.", 400)
  }

  const { requestId } = await context.params
  const result = await cancelOvertimeRequestAction({
    companyId: resolveCompanyId(session.context.user.companyId, session.context.claims.companyId),
    requestId,
    reason: parsed.data.reason,
  })

  if (!result.ok) {
    return mobileError(result.error, 400)
  }

  return mobileOk({ cancelled: true }, result.message)
}
