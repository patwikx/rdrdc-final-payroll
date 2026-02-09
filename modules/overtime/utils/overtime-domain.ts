import { RequestStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { overtimeDateInputSchema, overtimeTimeInputSchema } from "@/modules/overtime/schemas/overtime-domain-schemas"

export const parseOvertimeDateInput = (value: string): Date => {
  const parsed = overtimeDateInputSchema.parse(value)
  const [year, month, day] = parsed.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

export const parseOvertimeTimeInput = (value: string): Date => {
  const parsed = overtimeTimeInputSchema.parse(value)
  const [hour, minute] = parsed.split(":").map((part) => Number(part))
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0))
}

export const calculateOvertimeDurationHours = (start: string, end: string): number => {
  const parsedStart = overtimeTimeInputSchema.parse(start)
  const parsedEnd = overtimeTimeInputSchema.parse(end)
  const [startHour, startMinute] = parsedStart.split(":").map((part) => Number(part))
  const [endHour, endMinute] = parsedEnd.split(":").map((part) => Number(part))
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  return (endMinutes - startMinutes) / 60
}

export const generateOvertimeRequestNumber = async (): Promise<string> => {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })
    .format(new Date())
    .replace(/-/g, "")

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")
    const candidate = `OT-${stamp}-${suffix}`
    const exists = await db.overtimeRequest.findUnique({ where: { requestNumber: candidate }, select: { id: true } })
    if (!exists) return candidate
  }

  throw new Error("REQUEST_NUMBER_GENERATION_FAILED")
}

const dateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const dateTimeLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
})

export async function getEmployeePortalOvertimeRequestsReadModel(params: {
  employeeId: string
}) {
  const requests = await db.overtimeRequest.findMany({
    where: { employeeId: params.employeeId },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      requestNumber: true,
      overtimeDate: true,
      startTime: true,
      endTime: true,
      hours: true,
      reason: true,
      statusCode: true,
      supervisorApprovedAt: true,
      supervisorApprovalRemarks: true,
      hrApprovedAt: true,
      hrApprovalRemarks: true,
      hrRejectedAt: true,
      hrRejectionReason: true,
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
  })

  return requests.map((item) => ({
    id: item.id,
    requestNumber: item.requestNumber,
    overtimeDate: dateLabel.format(item.overtimeDate),
    startTime: item.startTime.toISOString(),
    endTime: item.endTime.toISOString(),
    hours: Number(item.hours),
    reason: item.reason,
    statusCode: item.statusCode,
    supervisorApproverName: item.supervisorApprover ? `${item.supervisorApprover.firstName} ${item.supervisorApprover.lastName}` : null,
    supervisorApprovedAt: item.supervisorApprovedAt ? dateLabel.format(item.supervisorApprovedAt) : null,
    supervisorApprovalRemarks: item.supervisorApprovalRemarks,
    hrApproverName: item.hrApprover ? `${item.hrApprover.firstName} ${item.hrApprover.lastName}` : null,
    hrApprovedAt: item.hrApprovedAt ? dateLabel.format(item.hrApprovedAt) : null,
    hrApprovalRemarks: item.hrApprovalRemarks,
    hrRejectedAt: item.hrRejectedAt ? dateLabel.format(item.hrRejectedAt) : null,
    hrRejectionReason: item.hrRejectionReason,
  }))
}

export async function getEmployeePortalOvertimeApprovalReadModel(params: {
  companyId: string
  isHR: boolean
  approverEmployeeId?: string
}) {
  const [requests, historyRequests] = await Promise.all([
    db.overtimeRequest.findMany({
      where: params.isHR
        ? {
            statusCode: RequestStatus.SUPERVISOR_APPROVED,
            employee: { companyId: params.companyId },
          }
        : {
            statusCode: RequestStatus.PENDING,
            supervisorApproverId: params.approverEmployeeId,
            employee: { companyId: params.companyId },
          },
      orderBy: params.isHR ? [{ supervisorApprovedAt: "asc" }, { createdAt: "asc" }] : [{ createdAt: "asc" }],
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            isOvertimeEligible: true,
          },
        },
      },
      take: 100,
    }),
    db.overtimeRequest.findMany({
      where: params.isHR
        ? {
            employee: { companyId: params.companyId },
            statusCode: { in: [RequestStatus.APPROVED, RequestStatus.REJECTED] },
            ...(params.approverEmployeeId ? { hrApproverId: params.approverEmployeeId } : {}),
          }
        : {
            employee: { companyId: params.companyId },
            supervisorApproverId: params.approverEmployeeId,
            statusCode: { in: [RequestStatus.SUPERVISOR_APPROVED, RequestStatus.APPROVED, RequestStatus.REJECTED] },
          },
      orderBy: params.isHR ? [{ hrApprovedAt: "desc" }, { hrRejectedAt: "desc" }] : [{ updatedAt: "desc" }],
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            isOvertimeEligible: true,
          },
        },
      },
      take: 300,
    }),
  ])

  const overtimeEmployeeIds = Array.from(
    new Set([...requests.map((item) => item.employee.id), ...historyRequests.map((item) => item.employee.id)])
  )

  const directReportCounts =
    overtimeEmployeeIds.length > 0
      ? await db.employee.groupBy({
          by: ["reportingManagerId"],
          where: {
            companyId: params.companyId,
            deletedAt: null,
            isActive: true,
            reportingManagerId: { in: overtimeEmployeeIds },
          },
          _count: { _all: true },
        })
      : []

  const directReportCountByManagerId = new Map<string, number>()
  for (const row of directReportCounts) {
    if (row.reportingManagerId) {
      directReportCountByManagerId.set(row.reportingManagerId, row._count._all)
    }
  }

  return {
    rows: requests.map((item) => ({
      id: item.id,
      requestNumber: item.requestNumber,
      overtimeDate: dateLabel.format(item.overtimeDate),
      hours: Number(item.hours),
      reason: item.reason,
      statusCode: item.statusCode,
      employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
      employeeNumber: item.employee.employeeNumber,
      ctoConversionPreview:
        !item.employee.isOvertimeEligible || (directReportCountByManagerId.get(item.employee.id) ?? 0) > 0,
    })),
    historyRows: historyRequests.map((item) => {
      const decidedAt = params.isHR
        ? item.hrApprovedAt ?? item.hrRejectedAt ?? item.approvedAt ?? item.rejectedAt ?? item.updatedAt
        : item.supervisorApprovedAt ?? item.rejectedAt ?? item.updatedAt

      return {
        id: item.id,
        requestNumber: item.requestNumber,
        overtimeDate: dateLabel.format(item.overtimeDate),
        hours: Number(item.hours),
        reason: item.reason,
        statusCode: item.statusCode,
        employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
        employeeNumber: item.employee.employeeNumber,
        ctoConversionPreview:
          !item.employee.isOvertimeEligible || (directReportCountByManagerId.get(item.employee.id) ?? 0) > 0,
        decidedAtIso: decidedAt.toISOString(),
        decidedAtLabel: dateTimeLabel.format(decidedAt),
      }
    }),
  }
}
