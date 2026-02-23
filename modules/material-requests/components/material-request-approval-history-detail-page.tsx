import Link from "next/link"
import { IconArrowLeft, IconPackage } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MaterialRequestApprovalDetailActions } from "@/modules/material-requests/components/material-request-approval-detail-actions"
import { MaterialRequestPrintButton } from "@/modules/material-requests/components/material-request-print-button"
import type { EmployeePortalMaterialRequestApprovalHistoryDetail } from "@/modules/material-requests/types/employee-portal-material-request-types"

type MaterialRequestApprovalHistoryDetailPageProps = {
  companyId: string
  companyName: string
  requestId: string
  detail: EmployeePortalMaterialRequestApprovalHistoryDetail
  pageTitle?: string
  primaryBackHref?: string
  primaryBackLabel?: string
  secondaryBackHref?: string
  secondaryBackLabel?: string
  showDecisionActions?: boolean
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const statusLabel = (status: string): string => status.replace(/_/g, " ")

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "CANCELLED") return "outline"
  return "secondary"
}

const stepStatusLabel = (status: string): string => status.replace(/_/g, " ")
const stepStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "SKIPPED") return "outline"
  return "secondary"
}

export function MaterialRequestApprovalHistoryDetailPage({
  companyId,
  companyName,
  requestId,
  detail,
  pageTitle = "Material Request History Detail",
  primaryBackHref,
  primaryBackLabel = "Back to History",
  secondaryBackHref,
  secondaryBackLabel = "Open Queue",
  showDecisionActions = false,
}: MaterialRequestApprovalHistoryDetailPageProps) {
  const resolvedPrimaryBackHref = primaryBackHref ?? `/${companyId}/employee-portal/approval-history`
  const resolvedSecondaryBackHref = secondaryBackHref ?? `/${companyId}/employee-portal/material-request-approvals`

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Approval Workspace</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{pageTitle}</h1>
              <Badge variant={statusVariant(detail.status)} className="rounded-full border px-2 py-1 text-xs shadow-none">
                {statusLabel(detail.status)}
              </Badge>
              {detail.isStoreUse ? (
                <Badge variant="outline" className="rounded-full border px-2 py-1 text-xs shadow-none">
                  For Store Use
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Request {detail.requestNumber} • {detail.requesterName} ({detail.requesterEmployeeNumber})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showDecisionActions ? (
              <MaterialRequestApprovalDetailActions
                companyId={companyId}
                requestId={requestId}
                backToQueueHref={`/${companyId}/employee-portal/material-request-approvals`}
              />
            ) : null}
            <MaterialRequestPrintButton
              payload={{
                companyName,
                requestNumber: detail.requestNumber,
                series: detail.series,
                requestType: detail.requestType,
                statusLabel: statusLabel(detail.status),
                requesterName: detail.requesterName,
                requesterEmployeeNumber: detail.requesterEmployeeNumber,
                departmentName: detail.departmentName,
                datePreparedLabel: detail.datePreparedLabel,
                dateRequiredLabel: detail.dateRequiredLabel,
                submittedAtLabel: detail.submittedAtLabel,
                approvedAtLabel: detail.approvedAtLabel,
                purpose: detail.purpose,
                remarks: detail.remarks,
                finalDecisionRemarks: detail.finalDecisionRemarks,
                subTotal: detail.subTotal,
                freight: detail.freight,
                discount: detail.discount,
                grandTotal: detail.grandTotal,
                items: detail.items.map((item) => ({
                  lineNumber: item.lineNumber,
                  itemCode: item.itemCode,
                  description: item.description,
                  uom: item.uom,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                  remarks: item.remarks,
                })),
                approvalSteps: detail.approvalSteps.map((step) => ({
                  stepNumber: step.stepNumber,
                  stepName: step.stepName,
                  approverName: step.approverName,
                  status: step.status,
                  actedByName: step.actedByName,
                  actedAtLabel: step.actedAtLabel,
                  remarks: step.remarks,
                })),
              }}
            />
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={resolvedPrimaryBackHref}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                {primaryBackLabel}
              </Link>
            </Button>
            {resolvedSecondaryBackHref ? (
              <Button type="button" variant="outline" className="rounded-lg" asChild>
                <Link href={resolvedSecondaryBackHref}>{secondaryBackLabel}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Series</Label>
            <Input value={detail.series} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Request No.</Label>
            <Input value={detail.requestNumber} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Request Type</Label>
            <Input value={detail.requestType} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Date Prepared</Label>
            <Input value={detail.datePreparedLabel} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Date Required</Label>
            <Input value={detail.dateRequiredLabel} readOnly />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Charge To</Label>
            <Input value={detail.chargeTo ?? detail.departmentName} readOnly />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-foreground">Building Code</Label>
            <Input value={detail.bldgCode ?? "-"} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Deliver To</Label>
            <Input value={detail.deliverTo ?? "-"} readOnly />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Purpose</Label>
            <Input value={detail.purpose ?? "-"} readOnly />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Remarks</Label>
            <Input value={detail.remarks ?? "-"} readOnly />
          </div>
        </div>

        <div className="overflow-hidden border-y border-border/60">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <IconPackage className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Request Items</h2>
            </div>
          </div>

          <div className="p-3">
            {detail.items.map((item, index) => (
              <div key={item.id} className="border-t border-border/60 py-3 first:border-t-0">
                <p className="mb-2 text-xs font-medium text-foreground">Line {index + 1}</p>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
                  <div className="space-y-1 lg:col-span-1">
                    <Label className="text-[11px] text-muted-foreground">Item Code</Label>
                    <Input value={item.itemCode ?? ""} readOnly className="text-xs" />
                  </div>
                  <div className="space-y-1 lg:col-span-2">
                    <Label className="text-[11px] text-muted-foreground">Description</Label>
                    <Input value={item.description} readOnly className="text-xs" />
                  </div>
                  <div className="space-y-1 lg:col-span-1">
                    <Label className="text-[11px] text-muted-foreground">UOM</Label>
                    <Input value={item.uom} readOnly className="text-xs" />
                  </div>
                  <div className="space-y-1 lg:col-span-1">
                    <Label className="text-[11px] text-muted-foreground">Quantity</Label>
                    <Input value={String(item.quantity)} readOnly className="text-xs" />
                  </div>
                  <div className="space-y-1 lg:col-span-1">
                    <Label className="text-[11px] text-muted-foreground">Unit Price</Label>
                    <Input value={item.unitPrice === null ? "" : currency.format(item.unitPrice)} readOnly className="text-xs" />
                  </div>
                  <div className="space-y-1 lg:col-span-1">
                    <Label className="text-[11px] text-muted-foreground">Remarks</Label>
                    <Input value={item.remarks ?? ""} readOnly className="text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Subtotal</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.subTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Freight</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.freight)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Discount</p>
            <p className="text-lg font-semibold text-foreground">PHP {currency.format(detail.discount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="text-lg font-semibold text-primary">PHP {currency.format(detail.grandTotal)}</p>
          </div>
        </div>

        <div className="border-t border-border/60 pt-4 sm:pt-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Approval Trail</h2>
          {detail.approvalSteps.length === 0 ? (
            <p className="text-xs text-muted-foreground">No approval steps available.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {detail.approvalSteps.map((step) => (
                <div key={step.id} className="rounded-xl border border-border/60 bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{step.stepName ?? `Step ${step.stepNumber}`}</p>
                    <Badge variant={stepStatusVariant(step.status)} className="rounded-full text-[10px]">
                      {stepStatusLabel(step.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium text-foreground">{step.approverName}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Action Time</p>
                  <p className="text-sm text-foreground">{step.actedAtLabel ?? "Pending"}</p>
                  {step.remarks?.trim() ? (
                    <>
                      <p className="mt-2 text-xs text-muted-foreground">Remarks</p>
                      <p className="text-sm text-foreground">{step.remarks}</p>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Request ID: {requestId} • Submitted: {detail.submittedAtLabel ?? "-"} • Approved: {detail.approvedAtLabel ?? "-"} • Rejected:{" "}
          {detail.rejectedAtLabel ?? "-"}
        </div>
      </div>
    </div>
  )
}
