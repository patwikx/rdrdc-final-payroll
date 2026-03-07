"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconChevronDown,
  IconClipboardList,
  IconFileInvoice,
  IconHash,
  IconMapPin,
  IconPackage,
  IconPackageImport,
  IconUser,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import { createPurchaseOrderAction } from "@/modules/procurement/actions/purchase-order-actions"
import { PurchaseOrderSupplierInput } from "@/modules/procurement/components/purchase-order-supplier-input"
import type { PurchaseOrderSourceRequestOption } from "@/modules/procurement/types/purchase-order-types"

type PurchaseOrderCreatePageProps = {
  companyId: string
  availableSourceRequests: PurchaseOrderSourceRequestOption[]
  nextPoNumber: string
  preferredSourceRequestId?: string
}

type PurchaseOrderLineForm = {
  sourcePurchaseRequestItemId: string
  lineNumber: number
  isSelected: boolean
  itemCode: string
  description: string
  uom: string
  requestedQuantity: string
  allocatedQuantity: string
  availableQuantity: string
  quantityOrdered: string
  unitPrice: string
  remarks: string
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const PURCHASE_ORDER_PAYMENT_TERMS = [
  "COD",
  "7 Days",
  "15 Days",
  "30 Days",
  "45 Days",
  "60 Days",
] as const
const PURCHASE_ORDER_PAYMENT_TERMS_OTHERS = "__OTHERS__"

const toNum = (value: string): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toQuantityText = (value: number): string => String(Math.round(Math.max(0, value) * 1000) / 1000)

const buildInitialLines = (request: PurchaseOrderSourceRequestOption): PurchaseOrderLineForm[] =>
  request.items.map((item, index) => ({
    sourcePurchaseRequestItemId: item.id,
    lineNumber: index + 1,
    isSelected: true,
    itemCode: item.itemCode,
    description: item.description,
    uom: item.uom,
    requestedQuantity: toQuantityText(item.requestedQuantity),
    allocatedQuantity: toQuantityText(item.allocatedQuantity),
    availableQuantity: toQuantityText(item.availableQuantity),
    quantityOrdered: toQuantityText(item.availableQuantity),
    unitPrice: String(item.unitPrice),
    remarks: item.remarks ?? "",
  }))

const computeLineTotal = (line: PurchaseOrderLineForm): number => {
  const qty = toNum(line.quantityOrdered)
  const unitPrice = toNum(line.unitPrice)
  return Math.round(qty * unitPrice * 100) / 100
}

export function PurchaseOrderCreatePage({
  companyId,
  availableSourceRequests,
  nextPoNumber,
  preferredSourceRequestId,
}: PurchaseOrderCreatePageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const preferredRequest =
    preferredSourceRequestId
      ? (availableSourceRequests.find((request) => request.id === preferredSourceRequestId) ?? null)
      : null
  const firstRequest = preferredRequest ?? availableSourceRequests[0] ?? null

  const [sourceRequestId, setSourceRequestId] = useState<string>(firstRequest?.id ?? "")
  const [sourceRequestOpen, setSourceRequestOpen] = useState(false)
  const [supplierName, setSupplierName] = useState("")
  const [paymentTermsOption, setPaymentTermsOption] = useState<string>("COD")
  const [customPaymentTerms, setCustomPaymentTerms] = useState("")
  const [applyVat, setApplyVat] = useState(false)
  const [discount, setDiscount] = useState("0")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [remarks, setRemarks] = useState("")

  const [lines, setLines] = useState<PurchaseOrderLineForm[]>(() =>
    firstRequest ? buildInitialLines(firstRequest) : []
  )

  const selectedRequest = useMemo(
    () => availableSourceRequests.find((request) => request.id === sourceRequestId) ?? null,
    [availableSourceRequests, sourceRequestId]
  )

  const handleSourceRequestChange = (requestId: string) => {
    setSourceRequestId(requestId)
    const selected = availableSourceRequests.find((request) => request.id === requestId)
    setLines(selected ? buildInitialLines(selected) : [])
  }

  const updateLine = (sourcePurchaseRequestItemId: string, patch: Partial<PurchaseOrderLineForm>) => {
    setLines((previous) =>
      previous.map((line) =>
        line.sourcePurchaseRequestItemId === sourcePurchaseRequestItemId ? { ...line, ...patch } : line
      )
    )
  }

  const setLineSelected = (sourcePurchaseRequestItemId: string, isSelected: boolean) => {
    updateLine(sourcePurchaseRequestItemId, { isSelected })
  }

  const setAllLinesSelected = (isSelected: boolean) => {
    setLines((previous) => previous.map((line) => ({ ...line, isSelected })))
  }

  const selectedLines = useMemo(() => lines.filter((line) => line.isSelected), [lines])
  const areAllLinesSelected = lines.length > 0 && selectedLines.length === lines.length
  const resolvedPaymentTerms =
    paymentTermsOption === PURCHASE_ORDER_PAYMENT_TERMS_OTHERS
      ? customPaymentTerms.trim()
      : paymentTermsOption
  const lineTotals = useMemo(() => lines.map(computeLineTotal), [lines])
  const subtotal = useMemo(
    () => lines.reduce((sum, line, index) => sum + (line.isSelected ? lineTotals[index] ?? 0 : 0), 0),
    [lineTotals, lines]
  )
  const discountAmount = useMemo(() => toNum(discount), [discount])
  const taxableBase = useMemo(() => subtotal - discountAmount, [discountAmount, subtotal])
  const vatAmount = useMemo(
    () => (applyVat && taxableBase > 0 ? Math.round(taxableBase * 12) / 100 : 0),
    [applyVat, taxableBase]
  )
  const grandTotal = useMemo(() => taxableBase + vatAmount, [taxableBase, vatAmount])

  const handleCreate = (options: { saveAsDraft: boolean }) => {
    if (!sourceRequestId) {
      toast.error("Select an approved source request.")
      return
    }

    if (!supplierName.trim()) {
      toast.error("Supplier name is required.")
      return
    }

    if (!resolvedPaymentTerms) {
      toast.error("Payment terms are required.")
      return
    }

    if (discountAmount < 0) {
      toast.error("Discount cannot be negative.")
      return
    }

    if (taxableBase < 0) {
      toast.error("Discount must not exceed the subtotal amount.")
      return
    }

    if (selectedLines.length === 0) {
      toast.error("Select at least one source request item.")
      return
    }

    for (const [index, line] of selectedLines.entries()) {
      if (!line.description.trim()) {
        toast.error(`Line ${index + 1}: description is required.`)
        return
      }

      if (!line.uom.trim()) {
        toast.error(`Line ${index + 1}: UOM is required.`)
        return
      }

      if (toNum(line.quantityOrdered) <= 0) {
        toast.error(`Line ${index + 1}: quantity must be greater than zero.`)
        return
      }

      if (toNum(line.quantityOrdered) - toNum(line.availableQuantity) > 0.0001) {
        toast.error(`Line ${index + 1}: ordered quantity cannot exceed available quantity.`)
        return
      }

      if (!line.unitPrice.trim()) {
        toast.error(`Line ${index + 1}: unit price is required.`)
        return
      }

      if (toNum(line.unitPrice) < 0) {
        toast.error(`Line ${index + 1}: unit price cannot be negative.`)
        return
      }
    }

    startTransition(async () => {
      const response = await createPurchaseOrderAction({
        companyId,
        sourceRequestId,
        supplierName: supplierName.trim(),
        paymentTerms: resolvedPaymentTerms,
        saveAsDraft: options.saveAsDraft,
        applyVat,
        discount: discountAmount,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        remarks: remarks.trim() || undefined,
        lines: selectedLines.map((line) => ({
          sourcePurchaseRequestItemId: line.sourcePurchaseRequestItemId,
          quantityOrdered: toNum(line.quantityOrdered),
          unitPrice: toNum(line.unitPrice),
          remarks: line.remarks.trim() || undefined,
        })),
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      if (response.purchaseOrderId) {
        router.push(`/${companyId}/employee-portal/purchase-orders/${response.purchaseOrderId}`)
      } else {
        router.push(`/${companyId}/employee-portal/purchase-orders`)
      }
      router.refresh()
    })
  }

  const todayLabel = toPhDateInputValue(new Date())

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Employee Self-Service</p>
            <div className="flex items-center gap-4">
              <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                <IconFileInvoice className="size-5 text-primary" />
                Create Purchase Order
              </h1>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                PR {"->"} PO
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a purchase order from an approved purchase request. You can award full or partial remaining quantities per request line to this supplier.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-[auto_auto_auto_auto]">
            <Button type="button" variant="outline" className="justify-self-start rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/purchase-orders`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to PO List
              </Link>
            </Button>
            <Button type="button" variant="outline" className="justify-self-start rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/purchase-orders`}>Cancel</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCreate({ saveAsDraft: true })}
              disabled={isPending || availableSourceRequests.length === 0}
              className="justify-self-start rounded-lg"
            >
              <IconPackageImport className="mr-1 h-4 w-4" />
              {isPending ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              type="button"
              onClick={() => handleCreate({ saveAsDraft: false })}
              disabled={isPending || availableSourceRequests.length === 0}
              className="justify-self-start rounded-lg"
            >
              <IconPackageImport className="mr-1 h-4 w-4" />
              {isPending ? "Creating..." : "Create & Open"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {availableSourceRequests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 py-16">
            <IconClipboardList className="size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground/60">No approved requests available</p>
            <p className="max-w-xs text-center text-xs text-muted-foreground/40">
              There are no approved purchase requests with available items for PO creation.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 rounded-lg">
              <Link href={`/${companyId}/employee-portal/purchase-orders`}>
                <IconArrowLeft className="mr-1 size-3" />
                Back to Purchase Orders
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Source Request", value: selectedRequest?.requestNumber ?? "-", icon: IconHash },
                { label: "Selected Items", value: `${selectedLines.length} of ${lines.length}`, icon: IconPackage },
                { label: "Subtotal", value: `PHP ${currency.format(subtotal)}`, icon: IconClipboardList },
                { label: "Grand Total", value: `PHP ${currency.format(grandTotal)}`, icon: IconFileInvoice },
              ].map((item) => (
                <div key={item.label} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-xl font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
            <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", paymentTermsOption === PURCHASE_ORDER_PAYMENT_TERMS_OTHERS ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Source Request <span className="text-destructive">*</span>
                </Label>
                <Popover open={sourceRequestOpen} onOpenChange={setSourceRequestOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={sourceRequestOpen}
                      disabled={isPending}
                      className={cn("w-full justify-between font-normal", !sourceRequestId && "text-muted-foreground")}
                    >
                      <span className="truncate">{selectedRequest ? selectedRequest.requestNumber : "Select request"}</span>
                      <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] rounded-lg border-border/60 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search requests..." />
                      <CommandList>
                        <CommandEmpty>No requests found.</CommandEmpty>
                        <CommandGroup>
                          {availableSourceRequests.map((request) => (
                            <CommandItem
                              key={request.id}
                              value={`${request.requestNumber} ${request.departmentName}`}
                              onSelect={() => {
                                handleSourceRequestChange(request.id)
                                setSourceRequestOpen(false)
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{request.requestNumber}</span>
                                <span className="text-[10px] text-muted-foreground">{request.departmentName}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">PO Number</Label>
                <Input value={nextPoNumber} readOnly className="bg-muted/40 text-muted-foreground font-medium tracking-tight" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">PO Date</Label>
                <Input value={todayLabel} readOnly className="bg-muted/40 text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">Expected Delivery</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      className={cn("w-full justify-start text-left font-normal", !expectedDeliveryDate && "text-muted-foreground")}
                    >
                      <IconCalendar className="mr-2 h-4 w-4" />
                      {expectedDeliveryDate || "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parsePhDateInputToPhDate(expectedDeliveryDate) ?? undefined}
                      onSelect={(date) => {
                        setExpectedDeliveryDate(date ? toPhDateInputValue(date) : "")
                      }}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Payment Terms <span className="text-destructive">*</span>
                </Label>
                <Select value={paymentTermsOption} onValueChange={setPaymentTermsOption}>
                  <SelectTrigger className="w-full" disabled={isPending}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURCHASE_ORDER_PAYMENT_TERMS.map((term) => (
                      <SelectItem key={term} value={term}>
                        {term}
                      </SelectItem>
                    ))}
                    <SelectItem value={PURCHASE_ORDER_PAYMENT_TERMS_OTHERS}>Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentTermsOption === PURCHASE_ORDER_PAYMENT_TERMS_OTHERS ? (
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">
                    Payment Terms Value <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={customPaymentTerms}
                    onChange={(event) => setCustomPaymentTerms(event.target.value)}
                    placeholder="Enter payment terms"
                    disabled={isPending}
                  />
                </div>
              ) : null}
            </div>
            </div>

            {selectedRequest ? (
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-4">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <IconHash className="size-3" />Request No.
                    </p>
                    <p className="text-xs font-semibold text-foreground">{selectedRequest.requestNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <IconUser className="size-3" />Requester
                    </p>
                    <p className="text-xs font-medium text-foreground">{selectedRequest.requesterName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <IconBuilding className="size-3" />Department
                    </p>
                    <p className="text-xs font-medium text-foreground">{selectedRequest.departmentName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <IconMapPin className="size-3" />Branch
                    </p>
                    <p className="text-xs font-medium text-foreground">{selectedRequest.requesterBranchName ?? "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <IconCalendar className="size-3" />Date Required
                    </p>
                    <p className="text-xs font-medium text-foreground">{selectedRequest.requiredDateLabel}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Supplier Information</h3>
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/60 bg-card p-4 sm:p-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">
                    Supplier <span className="text-destructive">*</span>
                  </Label>
                  <PurchaseOrderSupplierInput
                    value={supplierName}
                    onChange={setSupplierName}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">Remarks</Label>
                  <Textarea
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Additional notes or special instructions"
                    className="min-h-[70px] resize-none rounded-lg text-sm"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="flex flex-col gap-2 border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <IconPackage className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">PO Line Items</h3>
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {selectedLines.length} of {lines.length} selected
                    </Badge>
                  </div>
                </div>
                {lines.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-lg border border-border/60 bg-background px-3 py-1.5">
                      <Checkbox
                        id="po-apply-vat"
                        checked={applyVat}
                        onCheckedChange={(checked) => setApplyVat(checked === true)}
                        disabled={isPending}
                      />
                      <Label htmlFor="po-apply-vat" className="ml-2 text-xs text-foreground">
                        Add 12% VAT
                      </Label>
                    </div>
                  </div>
                ) : null}
              </div>

              {lines.length > 0 ? (
                <div className="overflow-hidden">
                  <div className="max-h-[28rem] overflow-y-auto p-2 md:hidden">
                    <div className="space-y-2">
                      {lines.map((line, index) => {
                        const lineTotal = lineTotals[index] ?? 0
                        return (
                          <div
                            key={line.sourcePurchaseRequestItemId}
                            className={cn(
                              "space-y-2 rounded-xl border border-border/60 bg-card p-3 transition-opacity",
                              !line.isSelected && "opacity-60"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={line.isSelected}
                                  onCheckedChange={(checked) =>
                                    setLineSelected(line.sourcePurchaseRequestItemId, checked === true)
                                  }
                                  disabled={isPending}
                                />
                                <p className="text-xs font-medium text-muted-foreground">Line #{line.lineNumber}</p>
                              </div>
                              <p className="text-xs font-semibold tabular-nums text-foreground">PHP {currency.format(lineTotal)}</p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Description</Label>
                              <Input value={line.description} readOnly className="h-8 bg-muted/40 text-muted-foreground" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">UOM</Label>
                                <Input value={line.uom} readOnly className="h-8 bg-muted/40 text-muted-foreground" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Available Qty</Label>
                                <Input value={line.availableQuantity} readOnly className="h-8 bg-muted/40 text-right tabular-nums text-muted-foreground" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Requested Qty</Label>
                                <Input value={line.requestedQuantity} readOnly className="h-8 bg-muted/40 text-right tabular-nums text-muted-foreground" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">Allocated Qty</Label>
                                <Input value={line.allocatedQuantity} readOnly className="h-8 bg-muted/40 text-right tabular-nums text-muted-foreground" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">
                                Ordered Qty <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                type="number"
                                min="0.001"
                                step="0.001"
                                max={line.availableQuantity}
                                value={line.quantityOrdered}
                                onChange={(event) =>
                                  updateLine(line.sourcePurchaseRequestItemId, { quantityOrdered: event.target.value })
                                }
                                className="h-8 text-right tabular-nums"
                                disabled={isPending || !line.isSelected}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">
                                Unit Price <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.unitPrice}
                                onChange={(event) =>
                                  updateLine(line.sourcePurchaseRequestItemId, { unitPrice: event.target.value })
                                }
                                className="h-8 text-right tabular-nums"
                                disabled={isPending || !line.isSelected}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Line Remarks</Label>
                              <Input
                                value={line.remarks}
                                onChange={(event) =>
                                  updateLine(line.sourcePurchaseRequestItemId, { remarks: event.target.value })
                                }
                                className="h-8"
                                disabled={isPending || !line.isSelected}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <div className="grid min-w-[1220px] grid-cols-[4.5rem_7rem_minmax(0,1.4fr)_4rem_5.5rem_5.5rem_5.5rem_5.5rem_7rem_minmax(0,1fr)_7rem] items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={areAllLinesSelected}
                          onCheckedChange={(checked) => setAllLinesSelected(checked === true)}
                          disabled={isPending || lines.length === 0}
                          aria-label="Select all purchase order lines"
                        />
                      </div>
                      <p>Item Code</p>
                      <p>Description</p>
                      <p>UOM</p>
                      <p className="text-right">Req Qty</p>
                      <p className="text-right">Alloc Qty</p>
                      <p className="text-right">Avail Qty</p>
                      <p className="text-right">
                        Ord Qty <span className="text-destructive">*</span>
                      </p>
                      <p className="text-right">
                        Unit Price <span className="text-destructive">*</span>
                      </p>
                      <p>Remarks</p>
                      <p className="text-right">Line Total</p>
                    </div>
                    <div className="max-h-[22rem] overflow-y-auto">
                      {lines.map((line, index) => {
                        const lineTotal = lineTotals[index] ?? 0
                        return (
                          <div
                            key={line.sourcePurchaseRequestItemId}
                            className={cn(
                              "grid min-w-[1220px] grid-cols-[4.5rem_7rem_minmax(0,1.4fr)_4rem_5.5rem_5.5rem_5.5rem_5.5rem_7rem_minmax(0,1fr)_7rem] items-center gap-2 border-b border-border/60 px-3 py-2 text-xs last:border-b-0",
                              !line.isSelected && "opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={line.isSelected}
                                onCheckedChange={(checked) =>
                                  setLineSelected(line.sourcePurchaseRequestItemId, checked === true)
                                }
                                disabled={isPending}
                              />
                              <p className="text-muted-foreground">{line.lineNumber}</p>
                            </div>
                            <Input value={line.itemCode} readOnly className="h-8 bg-muted/40 text-muted-foreground" />
                            <Input value={line.description} readOnly className="h-8 bg-muted/40 text-muted-foreground" />
                            <Input value={line.uom} readOnly className="h-8 bg-muted/40 text-muted-foreground" />
                            <Input value={line.requestedQuantity} readOnly className="h-8 bg-muted/40 text-right tabular-nums text-muted-foreground" />
                            <Input value={line.allocatedQuantity} readOnly className="h-8 bg-muted/40 text-right tabular-nums text-muted-foreground" />
                            <Input value={line.availableQuantity} readOnly className="h-8 bg-muted/40 text-right tabular-nums text-muted-foreground" />
                            <Input
                              type="number"
                              min="0.001"
                              step="0.001"
                              max={line.availableQuantity}
                              value={line.quantityOrdered}
                              onChange={(event) =>
                                updateLine(line.sourcePurchaseRequestItemId, { quantityOrdered: event.target.value })
                              }
                              className="h-8 text-right tabular-nums"
                              disabled={isPending || !line.isSelected}
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitPrice}
                              onChange={(event) =>
                                updateLine(line.sourcePurchaseRequestItemId, { unitPrice: event.target.value })
                              }
                              className="h-8 text-right tabular-nums"
                              disabled={isPending || !line.isSelected}
                            />
                            <Input
                              value={line.remarks}
                              onChange={(event) =>
                                updateLine(line.sourcePurchaseRequestItemId, { remarks: event.target.value })
                              }
                              className="h-8"
                              disabled={isPending || !line.isSelected}
                            />
                            <p className="text-right tabular-nums font-medium text-foreground">PHP {currency.format(lineTotal)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                  Select a source request with available items to populate line items.
                </div>
              )}

              {selectedLines.length > 0 ? (
                <div className="border-t border-border/60 bg-muted/10 px-4 py-3">
                  <div className="flex items-end justify-end">
                    <div className="w-full max-w-sm space-y-2">
                      <div className="flex items-center justify-between gap-4 text-right">
                        <p className="text-[11px] text-muted-foreground">Subtotal</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(subtotal)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-right">
                        <p className="text-[11px] text-muted-foreground">VAT (12%)</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(vatAmount)}</p>
                      </div>
                      <div className="grid grid-cols-[auto_minmax(0,12rem)] items-center gap-4">
                        <p className="text-[11px] text-muted-foreground text-right">Discount</p>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discount}
                          onChange={(event) => setDiscount(event.target.value)}
                          disabled={isPending}
                          className="h-8 text-right tabular-nums"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-2 text-right">
                        <p className="text-base text-foreground">Grand Total</p>
                        <p className="text-base font-bold text-foreground tabular-nums">PHP {currency.format(grandTotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : lines.length > 0 ? (
                <div className="border-t border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                  Select at least one request item to create this purchase order.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
