import Link from "next/link"
import { IconArrowLeft } from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { EmployeePortalOvertimeApprovalHistoryDetail } from "@/modules/overtime/types/overtime-domain-types"

type OvertimeApprovalHistoryDetailPageProps = {
  companyId: string
  requestId: string
  detail: EmployeePortalOvertimeApprovalHistoryDetail
}

const toStatusLabel = (statusCode: string): string => statusCode.replace(/_/g, " ")

const statusVariant = (statusCode: string): "default" | "secondary" | "destructive" | "outline" => {
  if (statusCode.includes("REJECT")) return "destructive"
  if (statusCode.includes("APPROVED")) return "default"
  if (statusCode.includes("CANCELLED")) return "outline"
  if (statusCode.includes("NOT_REACHED")) return "outline"
  return "secondary"
}

const getNameInitials = (fullName: string): string => {
  const initials = fullName
    .split(" ")
    .filter((part) => part.trim().length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "OT"
}

export function OvertimeApprovalHistoryDetailPage({
  companyId,
  requestId,
  detail,
}: OvertimeApprovalHistoryDetailPageProps) {
  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Approval Workspace</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Overtime Request History Detail</h1>
              <Badge variant="outline" className="rounded-full border px-2 py-1 text-xs shadow-none">
                OVERTIME
              </Badge>
              <Badge variant={statusVariant(detail.statusCode)} className="rounded-full border px-2 py-1 text-xs shadow-none">
                {toStatusLabel(detail.statusCode)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Request {detail.requestNumber} • Decided {detail.decidedAtLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/approval-history`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to History
              </Link>
            </Button>
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/overtime-approvals`}>Open Queue</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="w-fit max-w-full rounded-xl border border-border/60 bg-card p-3 lg:flex lg:h-full lg:w-[18rem] lg:flex-col">
            <p className="text-xs text-muted-foreground">Employee</p>
            <div className="mt-2 flex flex-col gap-3 lg:h-full lg:justify-between">
              <div className="flex w-full flex-1 items-center justify-center">
                <Avatar className="h-28 w-28 shrink-0 !rounded-xl border border-border/60 after:!rounded-xl sm:h-32 sm:w-32 lg:h-44 lg:w-44">
                  <AvatarImage src={detail.employeePhotoUrl ?? undefined} alt={detail.employeeName} className="!rounded-xl object-cover" />
                  <AvatarFallback className="!rounded-xl bg-primary/5 text-lg font-semibold text-primary">
                    {getNameInitials(detail.employeeName)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="w-full text-center">
                <p className="text-sm font-semibold text-foreground">{detail.employeeName}</p>
                <p className="text-xs text-muted-foreground">{detail.employeeNumber}</p>
                <p className="text-xs text-muted-foreground">{detail.departmentName}</p>
              </div>
            </div>
          </div>

          <div className="lg:flex-1">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">Request No.</Label>
                  <Input value={detail.requestNumber} readOnly />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">Overtime Date</Label>
                  <Input value={detail.overtimeDateLabel} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">Hours</Label>
                  <Input value={`${detail.hours.toFixed(2)} hour(s)`} readOnly />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">Conversion</Label>
                  <Input value={detail.ctoConversionPreview ? "CTO 1:1 conversion eligible" : "Standard Overtime"} readOnly />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">Request Reason</Label>
                <Textarea value={detail.reason?.trim() || "No reason provided."} readOnly className="min-h-[90px] resize-none rounded-lg text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 pt-4 sm:pt-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Approval Trail</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {detail.approvalTrail.map((step) => (
              <div key={step.id} className="rounded-xl border border-border/60 bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">{step.stageLabel}</p>
                  <Badge variant={statusVariant(step.statusCode)} className="rounded-full text-[10px]">
                    {toStatusLabel(step.statusCode)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="text-sm font-medium text-foreground">{step.approverName ?? "-"}</p>
                <p className="mt-2 text-xs text-muted-foreground">Acted At</p>
                <p className="text-sm text-foreground">{step.actedAtLabel ?? "-"}</p>
                {step.remarks?.trim() ? (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">Remarks</p>
                    <p className="text-sm text-foreground">{step.remarks}</p>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">Request ID: {requestId}</div>
      </div>
    </div>
  )
}
