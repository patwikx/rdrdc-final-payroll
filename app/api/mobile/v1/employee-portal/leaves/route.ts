import { NextRequest } from "next/server"
import { z } from "zod"

import { getPhYear } from "@/lib/ph-time"
import { requireMobileSession, getMobileEmployeeContext } from "@/modules/auth/utils/mobile-session"
import { mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { getEmployeePortalLeaveRequestsReadModel } from "@/modules/leave/utils/employee-portal-leave-read-models"
import { createLeaveRequestAction } from "@/modules/leave/actions/leave-request-actions"
import { createLeaveRequestInputSchema } from "@/modules/leave/schemas/leave-request-actions-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

const createPayloadSchema = createLeaveRequestInputSchema.omit({ companyId: true })

const resolveCompanyId = (companyId: string | null | undefined, fallback: string): string => companyId ?? fallback

export async function GET(request: NextRequest) {
  const session = await requireMobileSession(request)
  if (!session.ok) {
    return session.response
  }

  const companyRole = session.context.user.companyRole
  if (companyRole !== "EMPLOYEE") {
    return mobileError("Only employees can access leave requests in mobile portal.", 403)
  }

  const queryParsed = querySchema.safeParse({
    year: request.nextUrl.searchParams.get("year") ?? undefined,
  })
  if (!queryParsed.success) {
    return mobileError(queryParsed.error.issues[0]?.message ?? "Invalid leave query payload.", 400)
  }

  const companyId = resolveCompanyId(session.context.user.companyId, session.context.claims.companyId)
  const employee = await getMobileEmployeeContext({
    userId: session.context.user.id,
    companyId,
  })

  if (!employee) {
    return mobileError("Employee profile not found for the active company.", 404)
  }

  const model = await getEmployeePortalLeaveRequestsReadModel({
    companyId,
    employeeId: employee.id,
    year: queryParsed.data.year ?? getPhYear(),
  })

  return mobileOk(model)
}

export async function POST(request: NextRequest) {
  const session = await requireMobileSession(request)
  if (!session.ok) {
    return session.response
  }

  const companyRole = session.context.user.companyRole
  if (companyRole !== "EMPLOYEE") {
    return mobileError("Only employees can submit leave requests in mobile portal.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return mobileError("Invalid JSON payload.", 400)
  }

  const parsed = createPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Invalid leave request payload.", 400)
  }

  const result = await createLeaveRequestAction({
    companyId: resolveCompanyId(session.context.user.companyId, session.context.claims.companyId),
    ...parsed.data,
  })

  if (!result.ok) {
    return mobileError(result.error, 400)
  }

  return mobileOk({ submitted: true }, result.message)
}
