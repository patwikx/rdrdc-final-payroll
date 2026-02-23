"use server"

import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import {
  getMaterialRequestReceivingReportDetailsInputSchema,
  getMaterialRequestReceivingReportPageInputSchema,
  type GetMaterialRequestReceivingReportDetailsInput,
  type GetMaterialRequestReceivingReportPageInput,
} from "@/modules/material-requests/schemas/material-request-receiving-actions-schema"
import type {
  MaterialRequestActionDataResult,
} from "@/modules/material-requests/types/material-request-action-result"
import type {
  EmployeePortalMaterialRequestReceivingReportDetail,
  EmployeePortalMaterialRequestReceivingReportPage,
} from "@/modules/material-requests/types/employee-portal-material-request-types"
import {
  getEmployeePortalMaterialRequestReceivingReportDetailReadModel,
  getEmployeePortalMaterialRequestReceivingReportPageReadModel,
} from "@/modules/material-requests/utils/employee-portal-material-request-read-models"

const isHrRole = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

const getMaterialRequestReceivingScopeFlags = async (params: {
  userId: string
  companyId: string
}): Promise<{
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
}> => {
  const access = await db.userCompanyAccess.findUnique({
    where: {
      userId_companyId: {
        userId: params.userId,
        companyId: params.companyId,
      },
    },
    select: {
      isMaterialRequestPurchaser: true,
      isMaterialRequestPoster: true,
      isActive: true,
    },
  })

  if (!access?.isActive) {
    return {
      isMaterialRequestPurchaser: false,
      isMaterialRequestPoster: false,
    }
  }

  return {
    isMaterialRequestPurchaser: access.isMaterialRequestPurchaser,
    isMaterialRequestPoster: access.isMaterialRequestPoster,
  }
}

const canViewCompanyWideReceivingReports = (params: {
  role: CompanyRole
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
}): boolean => {
  return isHrRole(params.role) || params.isMaterialRequestPurchaser || params.isMaterialRequestPoster
}

export async function getMaterialRequestReceivingReportPageAction(
  input: GetMaterialRequestReceivingReportPageInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestReceivingReportPage>> {
  const parsed = getMaterialRequestReceivingReportPageInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid receiving report page payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const scopeFlags = await getMaterialRequestReceivingScopeFlags({
    userId: context.userId,
    companyId: context.companyId,
  })

  const canViewCompanyWide = canViewCompanyWideReceivingReports({
    role: companyRole,
    isMaterialRequestPurchaser: scopeFlags.isMaterialRequestPurchaser,
    isMaterialRequestPoster: scopeFlags.isMaterialRequestPoster,
  })

  const page = await getEmployeePortalMaterialRequestReceivingReportPageReadModel({
    companyId: context.companyId,
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    status: payload.status,
    departmentId: payload.departmentId,
    requesterUserId: canViewCompanyWide ? undefined : context.userId,
  })

  return {
    ok: true,
    data: page,
  }
}

export async function getMaterialRequestReceivingReportDetailsAction(
  input: GetMaterialRequestReceivingReportDetailsInput
): Promise<MaterialRequestActionDataResult<EmployeePortalMaterialRequestReceivingReportDetail>> {
  const parsed = getMaterialRequestReceivingReportDetailsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid receiving report detail payload." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const companyRole = context.companyRole as CompanyRole
  const scopeFlags = await getMaterialRequestReceivingScopeFlags({
    userId: context.userId,
    companyId: context.companyId,
  })

  const canViewCompanyWide = canViewCompanyWideReceivingReports({
    role: companyRole,
    isMaterialRequestPurchaser: scopeFlags.isMaterialRequestPurchaser,
    isMaterialRequestPoster: scopeFlags.isMaterialRequestPoster,
  })

  const detail = await getEmployeePortalMaterialRequestReceivingReportDetailReadModel({
    companyId: context.companyId,
    reportId: payload.reportId,
    requesterUserId: canViewCompanyWide ? undefined : context.userId,
  })

  if (!detail) {
    return { ok: false, error: "Receiving report not found." }
  }

  return {
    ok: true,
    data: detail,
  }
}
