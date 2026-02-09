import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"
import {
  OvertimeApprovalClient,
  type OvertimeApprovalHistoryRow,
  type OvertimeApprovalRow,
} from "@/modules/employee-portal/components/overtime-approval-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type OvertimeApprovalsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function OvertimeApprovalsPage({ params }: OvertimeApprovalsPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  const isHR = context.companyRole === "COMPANY_ADMIN" || context.companyRole === "HR_ADMIN" || context.companyRole === "PAYROLL_ADMIN"
  const canApprove = Boolean(context.employee?.user?.isRequestApprover)

  if (!isHR && !canApprove) {
    redirect(`/${context.companyId}/employee-portal`)
  }

  if (!isHR && !context.employee) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Your user account is not linked to an employee record. Please contact HR to link your account.
        </CardContent>
      </Card>
    )
  }

  const [requests, historyRequests] = await Promise.all([
    db.overtimeRequest.findMany({
      where: isHR
        ? {
            statusCode: "SUPERVISOR_APPROVED",
            employee: { companyId: context.companyId },
          }
        : {
            statusCode: "PENDING",
            supervisorApproverId: context.employee!.id,
            employee: { companyId: context.companyId },
          },
      orderBy: isHR ? [{ supervisorApprovedAt: "asc" }, { createdAt: "asc" }] : [{ createdAt: "asc" }],
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
      where: isHR
        ? {
            employee: { companyId: context.companyId },
            statusCode: { in: ["APPROVED", "REJECTED"] },
            ...(context.employee ? { hrApproverId: context.employee.id } : {}),
          }
        : {
            employee: { companyId: context.companyId },
            supervisorApproverId: context.employee!.id,
            statusCode: { in: ["SUPERVISOR_APPROVED", "APPROVED", "REJECTED"] },
          },
      orderBy: isHR ? [{ hrApprovedAt: "desc" }, { hrRejectedAt: "desc" }] : [{ updatedAt: "desc" }],
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
            companyId: context.companyId,
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

  const rows: OvertimeApprovalRow[] = requests.map((item) => ({
    id: item.id,
    requestNumber: item.requestNumber,
    overtimeDate: new Date(item.overtimeDate).toLocaleDateString("en-PH"),
    hours: Number(item.hours),
    reason: item.reason,
    statusCode: item.statusCode,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    employeeNumber: item.employee.employeeNumber,
    ctoConversionPreview:
      !item.employee.isOvertimeEligible || (directReportCountByManagerId.get(item.employee.id) ?? 0) > 0,
  }))

  const historyRows: OvertimeApprovalHistoryRow[] = historyRequests.map((item) => {
    const decidedAt = isHR
      ? item.hrApprovedAt ?? item.hrRejectedAt ?? item.approvedAt ?? item.rejectedAt ?? item.updatedAt
      : item.supervisorApprovedAt ?? item.rejectedAt ?? item.updatedAt
    return {
      id: item.id,
      requestNumber: item.requestNumber,
      overtimeDate: new Date(item.overtimeDate).toLocaleDateString("en-PH"),
      hours: Number(item.hours),
      reason: item.reason,
      statusCode: item.statusCode,
      employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
      employeeNumber: item.employee.employeeNumber,
      ctoConversionPreview:
        !item.employee.isOvertimeEligible || (directReportCountByManagerId.get(item.employee.id) ?? 0) > 0,
      decidedAtIso: decidedAt.toISOString(),
      decidedAtLabel: new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      }).format(decidedAt),
    }
  })

  return <OvertimeApprovalClient companyId={context.companyId} isHR={isHR} rows={rows} historyRows={historyRows} />
}
