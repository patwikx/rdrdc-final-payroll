import { NextResponse } from "next/server"

import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getUserAccessPreviewData,
  type UserAccessPreviewScope,
} from "@/modules/employees/user-access/utils/get-user-access-preview-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    companyId: string
  }>
}

const parsePositiveInt = (value: string | null): number | undefined => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return undefined
  return parsed
}

const parseScope = (value: string | null): UserAccessPreviewScope => {
  if (value === "EMPLOYEES" || value === "SYSTEM_USERS") return value
  return "ALL"
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params

  try {
    const activeCompany = await getActiveCompanyContext({ companyId })
    if (!hasModuleAccess(activeCompany.companyRole as CompanyRole, "employees")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const searchParams = url.searchParams
    const scope = parseScope(searchParams.get("scope"))
    const employeeLinkRaw = searchParams.get("empLink")
    const systemLinkRaw = searchParams.get("sysLink")
    const roleRaw = searchParams.get("role")
    const employeeLinkFilter =
      employeeLinkRaw === "LINKED" || employeeLinkRaw === "UNLINKED" ? employeeLinkRaw : undefined
    const systemLinkFilter =
      systemLinkRaw === "LINKED" || systemLinkRaw === "UNLINKED" ? systemLinkRaw : undefined
    const roleFilter =
      roleRaw === "EMPLOYEE" ||
      roleRaw === "HR_ADMIN" ||
      roleRaw === "PAYROLL_ADMIN" ||
      roleRaw === "COMPANY_ADMIN"
        ? roleRaw
        : undefined

    const data = await getUserAccessPreviewData(activeCompany.companyId, {
      query: searchParams.get("q") ?? undefined,
      scope,
      includeCompanyOptions: false,
      employeePage: parsePositiveInt(searchParams.get("empPage")),
      systemUserPage: parsePositiveInt(searchParams.get("sysPage")),
      employeeLinkFilter,
      systemLinkFilter,
      roleFilter,
    })

    const payload =
      scope === "EMPLOYEES"
        ? {
            scope,
            query: data.query,
            employeeLinkFilter: data.employeeLinkFilter,
            systemLinkFilter: data.systemLinkFilter,
            roleFilter: data.roleFilter,
            rows: data.rows,
            employeePagination: data.employeePagination,
          }
        : scope === "SYSTEM_USERS"
          ? {
              scope,
              query: data.query,
              employeeLinkFilter: data.employeeLinkFilter,
              systemLinkFilter: data.systemLinkFilter,
              roleFilter: data.roleFilter,
              systemUsers: data.systemUsers,
              systemUserPagination: data.systemUserPagination,
            }
          : {
              scope,
              query: data.query,
              employeeLinkFilter: data.employeeLinkFilter,
              systemLinkFilter: data.systemLinkFilter,
              roleFilter: data.roleFilter,
              rows: data.rows,
              systemUsers: data.systemUsers,
              employeePagination: data.employeePagination,
              systemUserPagination: data.systemUserPagination,
            }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Unable to load user access data." }, { status: 500 })
  }
}
