import { NextRequest } from "next/server"

import { requireMobileSession, getMobileEmployeeContext } from "@/modules/auth/utils/mobile-session"
import { mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { getEmployeePortalOvertimeRequestsReadModel } from "@/modules/overtime/utils/overtime-domain"
import {
  createOvertimeRequestAction,
} from "@/modules/employee-portal/actions/overtime-request-actions"
import { createOvertimeRequestInputSchema } from "@/modules/employee-portal/schemas/overtime-request-actions-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createPayloadSchema = createOvertimeRequestInputSchema.omit({ companyId: true })

const resolveCompanyId = (companyId: string | null | undefined, fallback: string): string => companyId ?? fallback

export async function GET(request: NextRequest) {
  const session = await requireMobileSession(request)
  if (!session.ok) {
    return session.response
  }

  const companyRole = session.context.user.companyRole
  if (companyRole !== "EMPLOYEE") {
    return mobileError("Only employees can access overtime requests in mobile portal.", 403)
  }

  const companyId = resolveCompanyId(session.context.user.companyId, session.context.claims.companyId)
  const employee = await getMobileEmployeeContext({
    userId: session.context.user.id,
    companyId,
  })

  if (!employee) {
    return mobileError("Employee profile not found for the active company.", 404)
  }

  const model = await getEmployeePortalOvertimeRequestsReadModel({
    employeeId: employee.id,
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
    return mobileError("Only employees can submit overtime requests in mobile portal.", 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return mobileError("Invalid JSON payload.", 400)
  }

  const parsed = createPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Invalid overtime request payload.", 400)
  }

  const result = await createOvertimeRequestAction({
    companyId: resolveCompanyId(session.context.user.companyId, session.context.claims.companyId),
    ...parsed.data,
  })

  if (!result.ok) {
    return mobileError(result.error, 400)
  }

  return mobileOk({ submitted: true }, result.message)
}
