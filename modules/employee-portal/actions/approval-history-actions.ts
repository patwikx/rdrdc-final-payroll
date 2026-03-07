"use server"

import { z } from "zod"

import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import type {
  ConsolidatedApprovalStatusFilter,
  ConsolidatedApprovalTypeFilter,
  EmployeePortalConsolidatedApprovalHistoryPage,
} from "@/modules/employee-portal/utils/approval-history-read-model"
import { getEmployeePortalConsolidatedApprovalHistoryPageReadModel } from "@/modules/employee-portal/utils/approval-history-read-model"

type ActionDataResult<T> = { ok: true; data: T } | { ok: false; error: string }

const consolidatedApprovalHistoryPageSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(120).default(""),
  type: z.enum(["ALL", "LEAVE", "OVERTIME", "MATERIAL", "PURCHASE"]).default("ALL"),
  status: z.enum(["ALL", "APPROVED", "REJECTED", "SUPERVISOR_APPROVED", "PENDING_APPROVAL", "CANCELLED"]).default("ALL"),
})

const hasHrPrivileges = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

export async function getConsolidatedApprovalHistoryPageAction(
  input: z.input<typeof consolidatedApprovalHistoryPageSchema>
): Promise<ActionDataResult<EmployeePortalConsolidatedApprovalHistoryPage>> {
  const parsed = consolidatedApprovalHistoryPageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid approval history payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const isHR = hasHrPrivileges(context.companyRole as CompanyRole)

  const page = await getEmployeePortalConsolidatedApprovalHistoryPageReadModel({
    companyId: context.companyId,
    approverUserId: context.userId,
    isHR,
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    type: payload.type as ConsolidatedApprovalTypeFilter,
    status: payload.status as ConsolidatedApprovalStatusFilter,
  })

  return {
    ok: true,
    data: page,
  }
}
