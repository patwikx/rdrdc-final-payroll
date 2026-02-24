"use server"

import { RequestStatus } from "@prisma/client"
import { z } from "zod"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { applyCtoCreditForApprovedOvertime } from "@/modules/employee-portal/utils/cto-conversion"
import type {
  EmployeePortalOvertimeApprovalHistoryPage,
  EmployeePortalOvertimeApprovalQueuePage,
} from "@/modules/overtime/types/overtime-domain-types"
import {
  getEmployeePortalOvertimeApprovalHistoryPageReadModel,
  getEmployeePortalOvertimeApprovalQueuePageReadModel,
} from "@/modules/overtime/utils/overtime-domain"

const pagingSchema = z.object({
  companyId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
})

const decisionSchema = z.object({
  companyId: z.string().uuid(),
  requestId: z.string().uuid(),
  remarks: z.string().trim().max(1000).optional(),
})

type ActionResult = { ok: true; message: string } | { ok: false; error: string }
type ActionDataResult<T> = { ok: true; data: T } | { ok: false; error: string }

const historyPageSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "APPROVED", "REJECTED", "SUPERVISOR_APPROVED"]).default("ALL"),
  filterCompanyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
})

const queuePageSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "PENDING", "SUPERVISOR_APPROVED"]).default("ALL"),
  filterCompanyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
})

const hasHrPrivileges = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

const getActiveCompanyScopesForUser = async (userId: string): Promise<Array<{ companyId: string; role: string }>> => {
  const accessRows = await db.userCompanyAccess.findMany({
    where: {
      userId,
      isActive: true,
      company: {
        isActive: true,
      },
    },
    select: {
      companyId: true,
      role: true,
    },
  })

  const uniqueByCompanyId = new Map<string, { companyId: string; role: string }>()
  for (const row of accessRows) {
    if (!uniqueByCompanyId.has(row.companyId)) {
      uniqueByCompanyId.set(row.companyId, { companyId: row.companyId, role: row.role })
    }
  }

  return Array.from(uniqueByCompanyId.values())
}

const findActorEmployeeInCompany = async (userId: string, companyId: string): Promise<{ id: string } | null> => {
  return db.employee.findFirst({
    where: {
      userId,
      companyId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  })
}

export async function getOvertimeRequestsForApprovalAction(input: z.input<typeof pagingSchema>) {
  const parsed = pagingSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const where = {
    supervisorApprover: {
      is: {
        userId: context.userId,
        deletedAt: null,
        isActive: true,
      },
    },
    statusCode: RequestStatus.PENDING,
    employee: { companyId: context.companyId },
  }

  const [total, data] = await Promise.all([
    db.overtimeRequest.count({ where }),
    db.overtimeRequest.findMany({
      where,
      orderBy: [{ createdAt: "asc" }],
      skip: (payload.page - 1) * payload.pageSize,
      take: payload.pageSize,
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        supervisorApprover: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        hrApprover: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ])

  return { ok: true as const, data: { data, total } }
}

export async function getOvertimeRequestsForHrApprovalAction(input: z.input<typeof pagingSchema>) {
  const parsed = pagingSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasHrPrivileges(context.companyRole as CompanyRole)) {
    return { ok: false as const, error: "Only HR or admins can access this queue." }
  }

  const where = {
    statusCode: RequestStatus.SUPERVISOR_APPROVED,
    employee: { companyId: context.companyId },
  }

  const [total, data] = await Promise.all([
    db.overtimeRequest.count({ where }),
    db.overtimeRequest.findMany({
      where,
      orderBy: [{ supervisorApprovedAt: "asc" }, { createdAt: "asc" }],
      skip: (payload.page - 1) * payload.pageSize,
      take: payload.pageSize,
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        supervisorApprover: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        hrApprover: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ])

  return { ok: true as const, data: { data, total } }
}

export async function getOvertimeApprovalHistoryPageAction(
  input: z.input<typeof historyPageSchema>
): Promise<ActionDataResult<EmployeePortalOvertimeApprovalHistoryPage>> {
  const parsed = historyPageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid approval history payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const isHR = hasHrPrivileges(context.companyRole as CompanyRole)
  const companyScopes = await getActiveCompanyScopesForUser(context.userId)
  const approverCompanyIds = companyScopes.map((scope) => scope.companyId)
  const hrCompanyIds = companyScopes
    .filter((scope) => hasHrPrivileges(scope.role as CompanyRole))
    .map((scope) => scope.companyId)
  const scopedCompanyIds = isHR ? hrCompanyIds : approverCompanyIds

  if (payload.filterCompanyId && !scopedCompanyIds.includes(payload.filterCompanyId)) {
    return { ok: false, error: "Invalid company filter for this approver context." }
  }

  const historyPage = await getEmployeePortalOvertimeApprovalHistoryPageReadModel({
    companyIds: scopedCompanyIds,
    isHR,
    approverUserId: context.userId,
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    status: payload.status,
    filterCompanyId: payload.filterCompanyId,
    departmentId: payload.departmentId,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
  })

  return {
    ok: true,
    data: historyPage,
  }
}

export async function getOvertimeApprovalQueuePageAction(
  input: z.input<typeof queuePageSchema>
): Promise<ActionDataResult<EmployeePortalOvertimeApprovalQueuePage>> {
  const parsed = queuePageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid approval queue payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const isHR = hasHrPrivileges(context.companyRole as CompanyRole)
  const companyScopes = await getActiveCompanyScopesForUser(context.userId)
  const approverCompanyIds = companyScopes.map((scope) => scope.companyId)
  const hrCompanyIds = companyScopes
    .filter((scope) => hasHrPrivileges(scope.role as CompanyRole))
    .map((scope) => scope.companyId)
  const scopedCompanyIds = isHR ? hrCompanyIds : approverCompanyIds

  if (payload.filterCompanyId && !scopedCompanyIds.includes(payload.filterCompanyId)) {
    return { ok: false, error: "Invalid company filter for this approver context." }
  }

  const queuePage = await getEmployeePortalOvertimeApprovalQueuePageReadModel({
    companyIds: scopedCompanyIds,
    isHR,
    approverUserId: context.userId,
    page: payload.page,
    pageSize: payload.pageSize,
    search: payload.search,
    status: payload.status,
    filterCompanyId: payload.filterCompanyId,
    departmentId: payload.departmentId,
  })

  return {
    ok: true,
    data: queuePage,
  }
}

export async function approveOvertimeBySupervisorAction(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      supervisorApprover: {
        is: {
          userId: context.userId,
          deletedAt: null,
          isActive: true,
        },
      },
      statusCode: RequestStatus.PENDING,
      employee: { companyId: context.companyId },
    },
    select: { id: true, supervisorApproverId: true },
  })

  if (!request) return { ok: false, error: "Overtime request not found or no longer pending." }

  await db.overtimeRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.SUPERVISOR_APPROVED,
      supervisorApprovedAt: new Date(),
      supervisorApprovalRemarks: payload.remarks?.trim() || null,
      approverId: request.supervisorApproverId ?? null,
      approvedAt: new Date(),
      approvalRemarks: payload.remarks?.trim() || null,
    },
  })

  return { ok: true, message: "Overtime request approved." }
}

export async function rejectOvertimeBySupervisorAction(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      supervisorApprover: {
        is: {
          userId: context.userId,
          deletedAt: null,
          isActive: true,
        },
      },
      statusCode: RequestStatus.PENDING,
      employee: { companyId: context.companyId },
    },
    select: { id: true, supervisorApproverId: true },
  })

  if (!request) return { ok: false, error: "Overtime request not found or no longer pending." }

  await db.overtimeRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.REJECTED,
      approverId: request.supervisorApproverId ?? null,
      rejectedAt: new Date(),
      rejectionReason: payload.remarks?.trim() || "Rejected by supervisor",
    },
  })

  return { ok: true, message: "Overtime request rejected." }
}

export async function approveOvertimeByHrAction(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasHrPrivileges(context.companyRole as CompanyRole)) {
    return { ok: false, error: "Only HR or admins can approve this request." }
  }

  const actor = await findActorEmployeeInCompany(context.userId, context.companyId)
  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      statusCode: RequestStatus.SUPERVISOR_APPROVED,
      employee: { companyId: context.companyId },
    },
    select: {
      id: true,
      requestNumber: true,
      employeeId: true,
      overtimeDate: true,
      hours: true,
      employee: {
        select: {
          isOvertimeEligible: true,
        },
      },
    },
  })
  if (!request) return { ok: false, error: "Overtime request not found or no longer eligible." }

  try {
    await db.$transaction(async (tx) => {
      const ctoResult = await applyCtoCreditForApprovedOvertime(tx, {
        companyId: context.companyId,
        employeeId: request.employeeId,
        overtimeRequestId: request.id,
        requestNumber: request.requestNumber,
        overtimeDate: request.overtimeDate,
        overtimeHours: Number(request.hours),
        isOvertimeEligible: request.employee.isOvertimeEligible,
        processedById: context.userId,
      })

      if (!ctoResult.ok) {
        throw new Error(ctoResult.error)
      }

      await tx.overtimeRequest.update({
        where: { id: request.id },
        data: {
          statusCode: RequestStatus.APPROVED,
          hrApproverId: actor?.id ?? null,
          hrApprovedAt: new Date(),
          hrApprovalRemarks: payload.remarks?.trim() || null,
          approverId: actor?.id ?? null,
          approvedAt: new Date(),
          approvalRemarks: payload.remarks?.trim() || null,
        },
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to approve overtime request: ${message}` }
  }

  return { ok: true, message: "Overtime request approved." }
}

export async function rejectOvertimeByHrAction(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  if (!hasHrPrivileges(context.companyRole as CompanyRole)) {
    return { ok: false, error: "Only HR or admins can reject this request." }
  }

  const actor = await findActorEmployeeInCompany(context.userId, context.companyId)
  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      statusCode: RequestStatus.SUPERVISOR_APPROVED,
      employee: { companyId: context.companyId },
    },
    select: { id: true },
  })
  if (!request) return { ok: false, error: "Overtime request not found or no longer eligible." }

  await db.overtimeRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.REJECTED,
      hrApproverId: actor?.id ?? null,
      hrRejectedAt: new Date(),
      hrRejectionReason: payload.remarks?.trim() || "Rejected by approver",
      rejectedAt: new Date(),
      rejectionReason: payload.remarks?.trim() || "Rejected by approver",
    },
  })

  return { ok: true, message: "Overtime request rejected." }
}
