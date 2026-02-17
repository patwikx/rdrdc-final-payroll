import { IconArrowLeft, IconChecklist, IconPackage, IconTimeline, IconUserCircle } from "@tabler/icons-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MaterialRequestPrintButton } from "@/modules/material-requests/components/material-request-print-button"
import type { EmployeePortalMaterialRequestRow } from "@/modules/material-requests/types/employee-portal-material-request-types"

type MaterialRequestDetailPageProps = {
  companyId: string
  companyName: string
  request: EmployeePortalMaterialRequestRow
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "CANCELLED") return "outline"
  if (status === "DRAFT") return "outline"
  return "secondary"
}

const statusLabel = (status: string): string => status.replace(/_/g, " ")

export function MaterialRequestDetailPage({ companyId, companyName, request }: MaterialRequestDetailPageProps) {
  const requestStatusLabel = statusLabel(request.status)

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Employee Self-Service</p>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Material Request Details</h1>
              <Badge variant={statusVariant(request.status)} className="rounded-full border px-2 py-1 text-xs shadow-none">
                {requestStatusLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Request #{request.requestNumber}</p>
          </div>

          <div className="flex items-center gap-2">
            <MaterialRequestPrintButton
              payload={{
                companyName,
                requestNumber: request.requestNumber,
                series: request.series,
                requestType: request.requestType,
                statusLabel: requestStatusLabel,
                requesterName: request.requesterName,
                requesterEmployeeNumber: request.requesterEmployeeNumber,
                departmentName: request.departmentName,
                datePreparedLabel: request.datePreparedLabel,
                dateRequiredLabel: request.dateRequiredLabel,
                submittedAtLabel: request.submittedAtLabel,
                approvedAtLabel: request.approvedAtLabel,
                processingStartedAtLabel: request.processingStartedAtLabel,
                processingCompletedAtLabel: request.processingCompletedAtLabel,
                processedByName: null,
                purpose: request.purpose,
                remarks: request.remarks,
                processingRemarks: request.processingRemarks,
                finalDecisionRemarks: request.finalDecisionRemarks,
                cancellationReason: request.cancellationReason,
                subTotal: request.subTotal,
                freight: request.freight,
                discount: request.discount,
                grandTotal: request.grandTotal,
                items: request.items.map((item) => ({
                  lineNumber: item.lineNumber,
                  itemCode: item.itemCode,
                  description: item.description,
                  uom: item.uom,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                  remarks: item.remarks,
                })),
                approvalSteps: request.approvalSteps.map((step) => ({
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
              <Link href={`/${companyId}/employee-portal/material-requests`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to Requests
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Department</p>
              <IconUserCircle className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{request.departmentName}</span>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Prepared / Required</p>
              <IconTimeline className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{request.datePreparedLabel}</span>
            <p className="text-xs text-muted-foreground">to {request.dateRequiredLabel}</p>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Items</p>
              <IconChecklist className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">{request.items.length}</span>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Current Step</p>
              <IconChecklist className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">
              {request.currentStep ? `${request.currentStep} / ${request.requiredSteps}` : "-"}
            </span>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Grand Total</p>
              <IconPackage className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">PHP {currency.format(request.grandTotal)}</span>
          </div>
        </div>

        <div className="border-t border-border/60 pt-4 sm:pt-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Request Information</h2>
          <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-medium text-foreground">Series / Type</p>
              <p>{request.series}/{request.requestType}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Submitted At</p>
              <p>{request.submittedAtLabel ?? "-"}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Charge To</p>
              <p>{request.chargeTo ?? request.departmentName}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Store Use</p>
              <p>{request.isStoreUse ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Building Code</p>
              <p>{request.bldgCode ?? "-"}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Deliver To</p>
              <p>{request.deliverTo ?? "-"}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Freight</p>
              <p>PHP {currency.format(request.freight)}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Discount</p>
              <p>PHP {currency.format(request.discount)}</p>
            </div>
          </div>

          {request.purpose || request.remarks || request.finalDecisionRemarks || request.cancellationReason ? (
            <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-muted-foreground md:grid-cols-2">
              {request.purpose ? (
                <div>
                  <p className="font-medium text-foreground">Purpose</p>
                  <p>{request.purpose}</p>
                </div>
              ) : null}
              {request.remarks ? (
                <div>
                  <p className="font-medium text-foreground">Remarks</p>
                  <p>{request.remarks}</p>
                </div>
              ) : null}
              {request.finalDecisionRemarks ? (
                <div>
                  <p className="font-medium text-foreground">Decision Remarks</p>
                  <p>{request.finalDecisionRemarks}</p>
                </div>
              ) : null}
              {request.cancellationReason ? (
                <div>
                  <p className="font-medium text-foreground">Cancellation Reason</p>
                  <p>{request.cancellationReason}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t border-border/60 pt-4 sm:pt-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">Requested Items</h2>
          </div>
          <div className="space-y-2 lg:hidden">
            {request.items.map((item) => (
              <div key={`item-card-${item.id}`} className="rounded-xl border border-border/60 bg-card p-3 text-xs">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">Line {item.lineNumber}</p>
                  <span className="text-muted-foreground">{item.uom}</span>
                </div>
                <p className="text-sm text-foreground">{item.description}</p>
                <p className="mt-1 text-muted-foreground">Code: {item.itemCode ?? "-"}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Qty</p>
                    <p className="text-foreground">{item.quantity.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Unit Price</p>
                    <p className="text-foreground">PHP {currency.format(item.unitPrice ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Line Total</p>
                    <p className="font-medium text-foreground">PHP {currency.format(item.lineTotal ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Remarks</p>
                    <p className="text-foreground">{item.remarks ?? "-"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card lg:block">
            <Table className="min-w-[980px] text-xs">
              <TableHeader>
                <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 w-[70px] px-3 text-[11px] uppercase tracking-wide">Line</TableHead>
                  <TableHead className="h-9 w-[120px] px-3 text-[11px] uppercase tracking-wide">Code</TableHead>
                  <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Description</TableHead>
                  <TableHead className="h-9 w-[80px] px-3 text-[11px] uppercase tracking-wide">UOM</TableHead>
                  <TableHead className="h-9 w-[90px] px-3 text-right text-[11px] uppercase tracking-wide">Qty</TableHead>
                  <TableHead className="h-9 w-[130px] px-3 text-right text-[11px] uppercase tracking-wide">Unit Price</TableHead>
                  <TableHead className="h-9 w-[130px] px-3 text-right text-[11px] uppercase tracking-wide">Line Total</TableHead>
                  <TableHead className="h-9 w-[220px] px-3 text-[11px] uppercase tracking-wide">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/20">
                    <TableCell className="px-3 py-3">{item.lineNumber}</TableCell>
                    <TableCell className="px-3 py-3 text-muted-foreground">{item.itemCode ?? "-"}</TableCell>
                    <TableCell className="px-3 py-3">{item.description}</TableCell>
                    <TableCell className="px-3 py-3">{item.uom}</TableCell>
                    <TableCell className="px-3 py-3 text-right">{item.quantity.toFixed(3)}</TableCell>
                    <TableCell className="px-3 py-3 text-right">PHP {currency.format(item.unitPrice ?? 0)}</TableCell>
                    <TableCell className="px-3 py-3 text-right">PHP {currency.format(item.lineTotal ?? 0)}</TableCell>
                    <TableCell className="px-3 py-3 text-muted-foreground">{item.remarks ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {request.approvalSteps.length > 0 ? (
          <div className="border-t border-border/60 pt-4 sm:pt-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Approval Trail</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {request.approvalSteps.map((step) => (
                <div key={step.id} className="border-t border-border/60 pt-2 text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {(step.stepName?.trim() || `Step ${step.stepNumber}`)} • {step.approverName}
                    </p>
                    <Badge variant={statusVariant(step.status)} className="rounded-full border px-2 py-0.5 text-[10px]">
                      {statusLabel(step.status)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">Acted by: {step.actedByName ?? "-"}</p>
                  <p className="text-muted-foreground">Acted at: {step.actedAtLabel ?? "-"}</p>
                  {step.remarks ? <p className="mt-1 text-muted-foreground">Remarks: {step.remarks}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
