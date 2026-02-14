"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconAlertCircle, IconArrowLeft, IconCheck, IconClipboardCheck, IconPackage, IconTruckDelivery } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { updateMaterialRequestProcessingStatusAction } from "@/modules/material-requests/actions/material-request-processing-actions"
import { MaterialRequestPrintButton } from "@/modules/material-requests/components/material-request-print-button"
import type { EmployeePortalMaterialRequestProcessingDetail } from "@/modules/material-requests/types/employee-portal-material-request-types"

type MaterialRequestProcessingDetailPageProps = {
  companyId: string
  companyName: string
  detail: EmployeePortalMaterialRequestProcessingDetail
}

type ProcessingAction =
  | { type: "NONE" }
  | { type: "IN_PROGRESS"; requestId: string; requestNumber: string }
  | { type: "COMPLETED"; requestId: string; requestNumber: string }

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const QUANTITY_TOLERANCE = 0.0005
const normalizeServeQuantityInput = (rawValue: string, maxValue: number): string => {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    return ""
  }

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ""
  }

  const clamped = Math.min(parsed, maxValue)
  return clamped.toFixed(3)
}

type ServeStatusUpdatePayload = {
  companyId: string
  requestId: string
  status: "IN_PROGRESS" | "COMPLETED"
  remarks: string
  processingPoNumber: string
  processingSupplierName: string
  servedItems?: Array<{
    materialRequestItemId: string
    quantityServed: number
  }>
}

const toProcessingStatusLabel = (value: string): string => value.replace(/_/g, " ")

const statusVariant = (status: string): "default" | "secondary" | "outline" => {
  if (status === "COMPLETED") {
    return "default"
  }

  if (status === "IN_PROGRESS") {
    return "secondary"
  }

  return "outline"
}

const approvalStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default"
  if (status === "REJECTED") return "destructive"
  if (status === "SKIPPED") return "outline"
  return "secondary"
}

const statusLabel = (status: string): string => status.replace(/_/g, " ")

export function MaterialRequestProcessingDetailPage({
  companyId,
  companyName,
  detail,
}: MaterialRequestProcessingDetailPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<ProcessingAction>({ type: "NONE" })
  const [remarks, setRemarks] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [serveQuantities, setServeQuantities] = useState<Record<string, string>>({})
  const [partialServePayload, setPartialServePayload] = useState<ServeStatusUpdatePayload | null>(null)
  const [isPartialConfirmOpen, setIsPartialConfirmOpen] = useState(false)
  const isAdditionalServeAction = action.type === "IN_PROGRESS" && detail.processingStatus === "IN_PROGRESS"
  const isPartiallyServed =
    detail.processingStatus === "IN_PROGRESS" &&
    detail.items.some((item) => item.servedQuantity > QUANTITY_TOLERANCE) &&
    detail.items.some((item) => item.remainingQuantity > QUANTITY_TOLERANCE)
  const canMarkCompleted =
    detail.processingStatus === "IN_PROGRESS" &&
    detail.items.every((item) => item.remainingQuantity <= QUANTITY_TOLERANCE)

  const openAction = (nextAction: ProcessingAction) => {
    setAction(nextAction)
    setRemarks(detail.processingRemarks ?? "")
    setPoNumber(detail.processingPoNumber ?? "")
    setSupplierName(detail.processingSupplierName ?? "")
    if (nextAction.type === "IN_PROGRESS") {
      const nextServeQuantities = detail.items.reduce<Record<string, string>>((accumulator, item) => {
        if (item.remainingQuantity > QUANTITY_TOLERANCE) {
          accumulator[item.id] = String(item.remainingQuantity)
        }

        return accumulator
      }, {})

      setServeQuantities(nextServeQuantities)
      return
    }

    setServeQuantities({})
  }

  const closeAction = () => {
    if (isPending) return
    setAction({ type: "NONE" })
    setRemarks("")
    setPoNumber("")
    setSupplierName("")
    setServeQuantities({})
    setPartialServePayload(null)
    setIsPartialConfirmOpen(false)
  }

  const executeStatusAction = (payload: ServeStatusUpdatePayload) => {
    startTransition(async () => {
      const response = await updateMaterialRequestProcessingStatusAction(payload)

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      closeAction()
      router.refresh()
    })
  }

  const submitAction = () => {
    if (action.type === "NONE") return
    const trimmedPoNumber = poNumber.trim()
    const trimmedSupplierName = supplierName.trim()
    const servedItems =
      action.type === "IN_PROGRESS"
        ? Object.entries(serveQuantities)
            .map(([materialRequestItemId, quantityInput]) => ({
              materialRequestItemId,
              quantityServed: Number.parseFloat(quantityInput),
            }))
            .filter((servedItem) => Number.isFinite(servedItem.quantityServed) && servedItem.quantityServed > 0)
        : []

    if (action.type === "IN_PROGRESS" && (!trimmedPoNumber || !trimmedSupplierName)) {
      toast.error("PO # and supplier are required to mark request as served.")
      return
    }

    if (action.type === "IN_PROGRESS" && servedItems.length === 0) {
      toast.error("Enter at least one line item quantity to serve.")
      return
    }

    if (action.type === "COMPLETED" && detail.items.some((item) => item.remainingQuantity > QUANTITY_TOLERANCE)) {
      toast.error("Cannot mark completed while there are remaining quantities to serve.")
      return
    }

    const payload: ServeStatusUpdatePayload = {
      companyId,
      requestId: action.requestId,
      status: action.type,
      remarks,
      processingPoNumber: trimmedPoNumber,
      processingSupplierName: trimmedSupplierName,
      servedItems: action.type === "IN_PROGRESS" ? servedItems : undefined,
    }

    if (action.type === "IN_PROGRESS") {
      const enteredByItemId = new Map(
        servedItems.map((servedItem) => [servedItem.materialRequestItemId, servedItem.quantityServed] as const)
      )
      const willRemainAfterServe = detail.items.some((item) => {
        const enteredQuantity = enteredByItemId.get(item.id) ?? 0
        return item.remainingQuantity - enteredQuantity > QUANTITY_TOLERANCE
      })

      if (willRemainAfterServe) {
        setPartialServePayload(payload)
        setIsPartialConfirmOpen(true)
        return
      }
    }

    executeStatusAction(payload)
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Purchasing Workspace</p>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Material Request Processing Details</h1>
              <Badge variant={statusVariant(detail.processingStatus)} className="rounded-full border px-2 py-1 text-xs shadow-none">
                {toProcessingStatusLabel(detail.processingStatus)}
              </Badge>
              {isPartiallyServed ? (
                <Badge variant="outline" className="rounded-full border-amber-500/60 bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  PARTIALLY SERVED
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">Request #{detail.requestNumber}</p>
          </div>

          <div className="flex items-center gap-2">
            {detail.processingStatus === "PENDING_PURCHASER" || detail.processingStatus === "IN_PROGRESS" ? (
              <Button
                type="button"
                className="rounded-lg"
                onClick={() =>
                  openAction({
                    type: "IN_PROGRESS",
                    requestId: detail.id,
                    requestNumber: detail.requestNumber,
                  })
                }
              >
                <IconTruckDelivery className="mr-1 h-4 w-4" />
                {detail.processingStatus === "IN_PROGRESS" ? "Add Served Qty" : "Mark as Served"}
              </Button>
            ) : null}
            {canMarkCompleted ? (
              <Button
                type="button"
                className="rounded-lg bg-green-600 hover:bg-green-700"
                onClick={() =>
                  openAction({
                    type: "COMPLETED",
                    requestId: detail.id,
                    requestNumber: detail.requestNumber,
                  })
                }
              >
                <IconCheck className="mr-1 h-4 w-4" />
                Mark Completed
              </Button>
            ) : null}
            <MaterialRequestPrintButton
              payload={{
                companyName,
                requestNumber: detail.requestNumber,
                series: detail.series,
                requestType: detail.requestType,
                statusLabel: "APPROVED",
                requesterName: detail.requesterName,
                requesterEmployeeNumber: detail.requesterEmployeeNumber,
                departmentName: detail.departmentName,
                datePreparedLabel: detail.datePreparedLabel,
                dateRequiredLabel: detail.dateRequiredLabel,
                submittedAtLabel: detail.submittedAtLabel,
                approvedAtLabel: detail.approvedAtLabel,
                processingStartedAtLabel: detail.processingStartedAtLabel,
                processingCompletedAtLabel: detail.processingCompletedAtLabel,
                processedByName: detail.processedByName,
                purpose: detail.purpose,
                remarks: detail.remarks,
                processingRemarks: detail.processingRemarks,
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
              <Link href={`/${companyId}/employee-portal/material-request-processing`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to Processing
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
              <IconClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{detail.requesterName}</span>
            <p className="text-xs text-muted-foreground">{detail.requesterEmployeeNumber}</p>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Department</p>
              <IconClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{detail.departmentName}</span>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Prepared / Required</p>
              <IconClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{detail.datePreparedLabel}</span>
            <p className="text-xs text-muted-foreground">to {detail.dateRequiredLabel}</p>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Approved At</p>
              <IconClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{detail.approvedAtLabel ?? "-"}</span>
          </div>

          <div className="px-1 py-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Grand Total</p>
              <IconPackage className="h-4 w-4 text-primary" />
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
            <p className="font-medium text-foreground">Processing Started</p>
            <p>{detail.processingStartedAtLabel ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Processing Completed</p>
            <p>{detail.processingCompletedAtLabel ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Processed By</p>
            <p>{detail.processedByName ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">PO #</p>
            <p>{detail.processingPoNumber ?? "-"}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Supplier</p>
            <p>{detail.processingSupplierName ?? "-"}</p>
          </div>
        </div>

        {detail.purpose || detail.remarks || detail.processingRemarks ? (
          <div className="mt-2 grid grid-cols-1 gap-3 text-xs text-muted-foreground md:grid-cols-2">
            {detail.purpose ? (
              <div>
                <p className="font-medium text-foreground">Purpose</p>
                <p>{detail.purpose}</p>
              </div>
            ) : null}
            {detail.remarks ? (
              <div>
                <p className="font-medium text-foreground">Remarks</p>
                <p>{detail.remarks}</p>
              </div>
            ) : null}
            {detail.processingRemarks ? (
              <div>
                <p className="font-medium text-foreground">Processing Notes</p>
                <p>{detail.processingRemarks}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-border/60 pt-4 sm:pt-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">Requested Items</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <Table className="min-w-[980px] text-xs">
              <TableHeader>
                <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 w-[70px] px-3 text-[11px] uppercase tracking-wide">Line</TableHead>
                  <TableHead className="h-9 w-[120px] px-3 text-[11px] uppercase tracking-wide">Code</TableHead>
                  <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Description</TableHead>
                  <TableHead className="h-9 w-[80px] px-3 text-[11px] uppercase tracking-wide">UOM</TableHead>
                  <TableHead className="h-9 w-[90px] px-3 text-right text-[11px] uppercase tracking-wide">Qty</TableHead>
                  <TableHead className="h-9 w-[110px] px-3 text-right text-[11px] uppercase tracking-wide">Served</TableHead>
                  <TableHead className="h-9 w-[110px] px-3 text-right text-[11px] uppercase tracking-wide">Remaining</TableHead>
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
                    <TableCell className="px-3 py-3 text-right">{item.quantity.toFixed(3)}</TableCell>
                    <TableCell className="px-3 py-3 text-right text-muted-foreground">{item.servedQuantity.toFixed(3)}</TableCell>
                    <TableCell className="px-3 py-3 text-right text-amber-600 dark:text-amber-400">{item.remainingQuantity.toFixed(3)}</TableCell>
                    <TableCell className="px-3 py-3 text-right">PHP {currency.format(item.unitPrice ?? 0)}</TableCell>
                    <TableCell className="px-3 py-3 text-right">PHP {currency.format(item.lineTotal ?? 0)}</TableCell>
                    <TableCell className="px-3 py-3 text-muted-foreground">{item.remarks ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      <Dialog open={action.type !== "NONE"} onOpenChange={(open) => (open ? null : closeAction())}>
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-[96vw] overflow-y-auto rounded-2xl border-border/60 shadow-none sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {action.type === "IN_PROGRESS"
                ? isAdditionalServeAction
                  ? "Add Served Quantity"
                  : "Mark Request as Served"
                : "Mark Request as Completed"}
            </DialogTitle>
            <DialogDescription>
              {action.type === "IN_PROGRESS"
                ? isAdditionalServeAction
                  ? "Record additional served quantities for this request."
                  : "Confirm the initial serving quantities for this request."
                : "Confirm that this material request is fully served and ready for posting."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/20">
                <div className="border-b border-border/60 px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">Request Information</p>
                </div>
                <div className="space-y-3 px-3 py-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Document No</p>
                    <p className="text-xl font-semibold text-foreground">{detail.requestNumber}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-muted-foreground">Requested By</p>
                      <p className="font-medium text-foreground">{detail.requesterName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Department</p>
                      <p className="font-medium text-foreground">{detail.departmentName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date Requested</p>
                      <p className="font-medium text-foreground">{detail.datePreparedLabel}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Items</p>
                      <p className="font-medium text-foreground">{detail.items.length} items</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Items to Serve</p>
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <div className="grid grid-cols-14 items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <p className="col-span-1">#</p>
                    <p className="col-span-4">Description</p>
                    <p className="col-span-2 text-right">Req.</p>
                    <p className="col-span-2 text-right">Prev.</p>
                    <p className="col-span-2 text-right">Rem.</p>
                    <p className="col-span-3 text-right">Serve</p>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {detail.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-14 items-center gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0">
                        <p className="col-span-1 text-muted-foreground">{item.lineNumber}</p>
                        <div className="col-span-4">
                          <p className="text-foreground">{item.description}</p>
                          <p className="text-[11px] text-muted-foreground">{item.uom}</p>
                        </div>
                        <p className="col-span-2 text-right font-medium text-foreground">{item.quantity.toFixed(3)}</p>
                        <p className="col-span-2 text-right font-medium text-muted-foreground">{item.servedQuantity.toFixed(3)}</p>
                        <p className="col-span-2 text-right font-medium text-amber-600 dark:text-amber-400">
                          {item.remainingQuantity.toFixed(3)}
                        </p>
                        <div className="col-span-3">
                          {action.type === "IN_PROGRESS" ? (
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={item.remainingQuantity}
                              step="0.001"
                              value={serveQuantities[item.id] ?? ""}
                              onChange={(event) =>
                                setServeQuantities((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              onBlur={(event) => {
                                const normalizedValue = normalizeServeQuantityInput(
                                  event.target.value,
                                  item.remainingQuantity
                                )
                                setServeQuantities((current) => ({
                                  ...current,
                                  [item.id]: normalizedValue,
                                }))
                              }}
                              disabled={isPending || item.remainingQuantity <= QUANTITY_TOLERANCE}
                              className="w-full text-right font-medium tabular-nums"
                            />
                          ) : (
                            <p className="text-right font-medium text-foreground">-</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>
                  Supplier <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder="Supplier name"
                  maxLength={160}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Purchase Order Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={poNumber}
                  onChange={(event) => setPoNumber(event.target.value)}
                  placeholder="Enter PO number from SAP"
                  maxLength={80}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">Enter the purchase order number from SAP system.</p>
              </div>

              <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-3 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <IconAlertCircle className="h-4 w-4" />
                  Important
                </div>
                <p className="text-sm">
                  {action.type === "IN_PROGRESS"
                    ? "You can serve partial quantities now and continue serving the remaining quantities later."
                    : "Only complete this request when all quantities have been fully served."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Add any notes about serving this request..."
                  rows={6}
                  maxLength={1000}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAction} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={submitAction} disabled={isPending}>
              {isPending
                ? "Saving..."
                : action.type === "IN_PROGRESS"
                  ? isAdditionalServeAction
                    ? "Save Served Qty"
                    : "Mark as Served"
                  : "Mark Completed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isPartialConfirmOpen} onOpenChange={setIsPartialConfirmOpen}>
        <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Proceed as Partially Served?</AlertDialogTitle>
            <AlertDialogDescription>
              This serve action does not complete all requested quantities yet. The request will remain in progress and
              you can add another served batch later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Review Quantities</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !partialServePayload}
              onClick={() => {
                if (!partialServePayload) {
                  return
                }

                executeStatusAction(partialServePayload)
              }}
            >
              Confirm Partial Serve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
