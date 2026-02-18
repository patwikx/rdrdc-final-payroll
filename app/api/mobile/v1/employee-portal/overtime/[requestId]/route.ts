import { NextRequest } from "next/server"

import { requireMobileSession } from "@/modules/auth/utils/mobile-session"
import { mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { updateOvertimeRequestAction } from "@/modules/employee-portal/actions/overtime-request-actions"
import { updateOvertimeRequestInputSchema } from "@/modules/employee-portal/schemas/overtime-request-actions-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const updatePayloadSchema = updateOvertimeRequestInputSchema.omit({
  companyId: true,
  requestId: true,
})

const resolveCompanyId = (companyId: string | null | undefined, fallback: string): string => companyId ?? fallback

type RouteContext = {
  params: Promise<{ requestId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireMobileSession(request)
  if (!session.ok) {
    return session.response
  }

  const companyRole = session.context.user.companyRole
  if (companyRole !== "EMPLOYEE") {
    return mobileError("Only employees can update overtime requests in mobile portal.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return mobileError("Invalid JSON payload.", 400)
  }

  const parsed = updatePayloadSchema.safeParse(body)
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Invalid overtime update payload.", 400)
  }

  const { requestId } = await context.params
  const result = await updateOvertimeRequestAction({
    companyId: resolveCompanyId(session.context.user.companyId, session.context.claims.companyId),
    requestId,
    ...parsed.data,
  })

  if (!result.ok) {
    return mobileError(result.error, 400)
  }

  return mobileOk({ updated: true }, result.message)
}
