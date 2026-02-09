"use server"

import { RequestStatus } from "@prisma/client"
import { z } from "zod"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { applyCtoCreditForApprovedOvertime } from "@/modules/employee-portal/utils/cto-conversion"

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

const hasHrPrivileges = (role: CompanyRole): boolean => {
  return role === "COMPANY_ADMIN" || role === "HR_ADMIN" || role === "PAYROLL_ADMIN"
}

const findActorEmployee = async (userId: string, companyId: string): Promise<{ id: string } | null> => {
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
  const actor = await findActorEmployee(context.userId, context.companyId)
  if (!actor) return { ok: false as const, error: "Employee profile not found." }

  const where = {
    supervisorApproverId: actor.id,
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

export async function approveOvertimeBySupervisorAction(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid request payload." }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })
  const actor = await findActorEmployee(context.userId, context.companyId)
  if (!actor) return { ok: false, error: "Employee profile not found." }

  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      supervisorApproverId: actor.id,
      statusCode: RequestStatus.PENDING,
      employee: { companyId: context.companyId },
    },
    select: { id: true },
  })

  if (!request) return { ok: false, error: "Overtime request not found or no longer pending." }

  await db.overtimeRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.SUPERVISOR_APPROVED,
      supervisorApprovedAt: new Date(),
      supervisorApprovalRemarks: payload.remarks?.trim() || null,
      approverId: actor.id,
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
  const actor = await findActorEmployee(context.userId, context.companyId)
  if (!actor) return { ok: false, error: "Employee profile not found." }

  const request = await db.overtimeRequest.findFirst({
    where: {
      id: payload.requestId,
      supervisorApproverId: actor.id,
      statusCode: RequestStatus.PENDING,
      employee: { companyId: context.companyId },
    },
    select: { id: true },
  })

  if (!request) return { ok: false, error: "Overtime request not found or no longer pending." }

  await db.overtimeRequest.update({
    where: { id: request.id },
    data: {
      statusCode: RequestStatus.REJECTED,
      approverId: actor.id,
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

  const actor = await findActorEmployee(context.userId, context.companyId)
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

  const actor = await findActorEmployee(context.userId, context.companyId)
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
