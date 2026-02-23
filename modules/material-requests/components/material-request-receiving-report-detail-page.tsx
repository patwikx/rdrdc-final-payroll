import { IconArrowLeft, IconChecklist, IconReceipt2, IconUserCircle } from "@tabler/icons-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  MaterialRequestReceivingReportPrintButton,
} from "@/modules/material-requests/components/material-request-receiving-report-print-button"
import type {
  EmployeePortalMaterialRequestReceivingReportDetail,
} from "@/modules/material-requests/types/employee-portal-material-request-types"

type MaterialRequestReceivingReportDetailPageProps = {
  companyId: string
  companyName: string
  detail: EmployeePortalMaterialRequestReceivingReportDetail
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const statusVariant = (status: string): "default" | "secondary" | "outline" => {
  if (status === "POSTED") {
    return "default"
  }

  return "secondary"
}

const statusLabel = (status: string): string => status.replace(/_/g, " ")

const approvalStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "SKIPPED") return "outline"
  return "secondary"
}

export function MaterialRequestReceivingReportDetailPage({
  companyId,
  companyName,
  detail,
}: MaterialRequestReceivingReportDetailPageProps) {
  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Receiving Workspace</p>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Receiving Report Details</h1>
              <Badge variant={statusVariant(detail.postingStatus)} className="rounded-full border px-2 py-1 text-xs shadow-none">
                {statusLabel(detail.postingStatus)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Report #{detail.reportNumber} • Request #{detail.requestNumber}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MaterialRequestReceivingReportPrintButton
              payload={{
                companyName,
                reportNumber: detail.reportNumber,
                requestNumber: detail.requestNumber,
                requesterName: detail.requesterName,
                requesterEmployeeNumber: detail.requesterEmployeeNumber,
                departmentName: detail.departmentName,
                datePreparedLabel: detail.datePreparedLabel,
                dateRequiredLabel: detail.dateRequiredLabel,
                processingCompletedAtLabel: detail.processingCompletedAtLabel,
                requesterAcknowledgedAtLabel: detail.requesterAcknowledgedAtLabel,
                receivedAtLabel: detail.receivedAtLabel,
                receivedByName: detail.receivedByName,
                postingStatus: detail.postingStatus,
                postingReference: detail.postingReference,
                postedAtLabel: detail.postedAtLabel,
                postedByName: detail.postedByName,
                remarks: detail.remarks,
                subTotal: detail.subTotal,
                freight: detail.freight,
                discount: detail.discount,
                grandTotal: detail.grandTotal,
                items: detail.items.map((item) => ({
                  lineNumber: item.lineNumber,
                  itemCode: item.itemCode,
                  description: item.description,
                  uom: item.uom,
                  requestedQuantity: item.requestedQuantity,
                  receivedQuantity: item.receivedQuantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                  remarks: item.remarks,
                })),
              }}
            />
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/material-request-receiving-reports`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to Reports
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Requester</p>
              <IconUserCircle className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{detail.requesterName}</span>
            <p className="text-xs text-muted-foreground">{detail.requesterEmployeeNumber}</p>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Department</p>
              <IconChecklist className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{detail.departmentName}</span>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Prepared / Required</p>
              <IconChecklist className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{detail.datePreparedLabel}</span>
            <p className="text-xs text-muted-foreground">to {detail.dateRequiredLabel}</p>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Received At</p>
              <IconReceipt2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{detail.receivedAtLabel}</span>
            <p className="text-xs text-muted-foreground">By {detail.receivedByName}</p>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Grand Total</p>
              <IconReceipt2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">PHP {currency.format(detail.grandTotal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-medium text-foreground">Series / Type</p>
            <p>{detail.series}/{detail.requestType}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Submitted At</p>
            <p>{detail.submittedAtLabel ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Approved At</p>
            <p>{detail.approvedAtLabel ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Processing Completed</p>
            <p>{detail.processingCompletedAtLabel ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Acknowledged At</p>
            <p>{detail.requesterAcknowledgedAtLabel ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Posting Reference</p>
            <p>{detail.postingReference ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Posted At</p>
            <p>{detail.postedAtLabel ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Posted By</p>
            <p>{detail.postedByName ?? "-"}</p>
          </div>
        </div>

        {detail.purpose || detail.requestRemarks || detail.remarks ? (
          <div className="mt-2 grid grid-cols-1 gap-3 text-xs text-muted-foreground md:grid-cols-2">
            {detail.purpose ? (
              <div>
                <p className="font-medium text-foreground">Purpose</p>
                <p>{detail.purpose}</p>
              </div>
            ) : null}
            {detail.requestRemarks ? (
              <div>
                <p className="font-medium text-foreground">Request Remarks</p>
                <p>{detail.requestRemarks}</p>
              </div>
            ) : null}
            {detail.remarks ? (
              <div>
                <p className="font-medium text-foreground">Receiving Notes</p>
                <p>{detail.remarks}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-border/60 pt-4 sm:pt-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">Received Items</h2>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card lg:block">
            <Table className="min-w-[1040px] text-xs">
              <TableHeader>
                <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 w-[70px] px-3 text-[11px] uppercase tracking-wide">Line</TableHead>
                  <TableHead className="h-9 w-[120px] px-3 text-[11px] uppercase tracking-wide">Code</TableHead>
                  <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Description</TableHead>
                  <TableHead className="h-9 w-[80px] px-3 text-[11px] uppercase tracking-wide">UOM</TableHead>
                  <TableHead className="h-9 w-[110px] px-3 text-right text-[11px] uppercase tracking-wide">Requested</TableHead>
                  <TableHead className="h-9 w-[110px] px-3 text-right text-[11px] uppercase tracking-wide">Received</TableHead>
                  <TableHead className="h-9 w-[130px] px-3 text-right text-[11px] uppercase tracking-wide">Unit Price</TableHead>
                  <TableHead className="h-9 w-[130px] px-3 text-right text-[11px] uppercase tracking-wide">Line Total</TableHead>
                  <TableHead className="h-9 w-[220px] px-3 text-[11px] uppercase tracking-wide">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/20">
                    <TableCell className="px-3 py-3">{item.lineNumber}</TableCell>
                    <TableCell className="px-3 py-3 text-muted-foreground">{item.itemCode ?? "-"}</TableCell>
                    <TableCell className="px-3 py-3">{item.description}</TableCell>
                    <TableCell className="px-3 py-3">{item.uom}</TableCell>
                    <TableCell className="px-3 py-3 text-right">{item.requestedQuantity.toFixed(3)}</TableCell>
                    <TableCell className="px-3 py-3 text-right text-muted-foreground">{item.receivedQuantity.toFixed(3)}</TableCell>
                    <TableCell className="px-3 py-3 text-right">PHP {currency.format(item.unitPrice ?? 0)}</TableCell>
                    <TableCell className="px-3 py-3 text-right">PHP {currency.format(item.lineTotal ?? 0)}</TableCell>
                    <TableCell className="px-3 py-3 text-muted-foreground">{item.remarks ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 lg:hidden">
            {detail.items.map((item) => (
              <div key={`receiving-item-card-${item.id}`} className="rounded-xl border border-border/60 bg-card p-3 text-xs">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">Line {item.lineNumber}</p>
                  <span className="text-muted-foreground">{item.uom}</span>
                </div>
                <p className="text-sm text-foreground">{item.description}</p>
                <p className="mt-1 text-muted-foreground">Code: {item.itemCode ?? "-"}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Requested</p>
                    <p className="text-foreground">{item.requestedQuantity.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Received</p>
                    <p className="text-foreground">{item.receivedQuantity.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Unit Price</p>
                    <p className="text-foreground">PHP {currency.format(item.unitPrice ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Line Total</p>
                    <p className="font-medium text-foreground">PHP {currency.format(item.lineTotal ?? 0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 border-t border-border/60 pt-4 text-xs md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Sub Total</p>
            <p className="font-medium text-foreground">PHP {currency.format(detail.subTotal)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Freight</p>
            <p className="font-medium text-foreground">PHP {currency.format(detail.freight)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Discount</p>
            <p className="font-medium text-foreground">PHP {currency.format(detail.discount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Grand Total</p>
            <p className="font-medium text-foreground">PHP {currency.format(detail.grandTotal)}</p>
          </div>
        </div>

        {detail.approvalSteps.length > 0 ? (
          <div className="border-t border-border/60 pt-4 sm:pt-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Approval Trail</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {detail.approvalSteps.map((step) => (
                <div key={step.id} className="border-t border-border/60 pt-2 text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {(step.stepName?.trim() || `Step ${step.stepNumber}`)} • {step.approverName}
                    </p>
                    <Badge variant={approvalStatusVariant(step.status)} className="rounded-full border px-2 py-0.5 text-[10px]">
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
