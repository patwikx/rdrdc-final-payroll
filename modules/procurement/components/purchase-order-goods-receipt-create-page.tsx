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
  IconMapPin,
  IconReceipt2,
  IconUser,
} from "@tabler/icons-react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Calendar } from "@/components/ui/calendar"
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
import { Textarea } from "@/components/ui/textarea"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import { createPurchaseOrderGoodsReceiptAction } from "@/modules/procurement/actions/purchase-order-actions"
import type { PurchaseOrderGoodsReceiptSourceOrderOption } from "@/modules/procurement/types/purchase-order-types"

type PurchaseOrderGoodsReceiptCreatePageProps = {
  companyId: string
  availableOrders: PurchaseOrderGoodsReceiptSourceOrderOption[]
  nextGrpoNumber: string
  initialPurchaseOrderId?: string
}

type ReceiptLineForm = {
  purchaseOrderLineId: string
  lineNumber: number
  itemCode: string
  description: string
  uom: string
  quantityOrdered: number
  quantityReceived: number
  quantityRemaining: number
  unitPrice: number
  remarks: string
  receiveNow: string
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const quantity = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

const QUANTITY_TOLERANCE = 0.0001

const toNum = (value: string): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toCurrency = (value: number): number => Math.round(value * 100) / 100
const toStatusLabel = (status: string): string => status.replaceAll("_", " ")
const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "CANCELLED") return "outline"
  if (status === "CLOSED") return "default"
  if (status === "FULLY_RECEIVED") return "default"
  if (status === "PARTIALLY_RECEIVED") return "secondary"
  if (status === "OPEN") return "secondary"
  return "outline"
}

const buildInitialLines = (order: PurchaseOrderGoodsReceiptSourceOrderOption): ReceiptLineForm[] =>
  order.lines.map((line) => ({
    purchaseOrderLineId: line.id,
    lineNumber: line.lineNumber,
    itemCode: line.itemCode,
    description: line.description,
    uom: line.uom,
    quantityOrdered: line.quantityOrdered,
    quantityReceived: line.quantityReceived,
    quantityRemaining: line.quantityRemaining,
    unitPrice: line.unitPrice,
    remarks: line.remarks ?? "",
    receiveNow: "0",
  }))

export function PurchaseOrderGoodsReceiptCreatePage({
  companyId,
  availableOrders,
  nextGrpoNumber,
  initialPurchaseOrderId,
}: PurchaseOrderGoodsReceiptCreatePageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [orderOpen, setOrderOpen] = useState(false)

  const firstOrder =
    availableOrders.find((order) => order.id === initialPurchaseOrderId) ??
    availableOrders[0] ??
    null

  const [purchaseOrderId, setPurchaseOrderId] = useState(firstOrder?.id ?? "")
  const [receivedAt, setReceivedAt] = useState(toPhDateInputValue(new Date()))
  const [remarks, setRemarks] = useState("")
  const [lines, setLines] = useState<ReceiptLineForm[]>(() => (firstOrder ? buildInitialLines(firstOrder) : []))

  const selectedOrder = useMemo(
    () => availableOrders.find((order) => order.id === purchaseOrderId) ?? null,
    [availableOrders, purchaseOrderId]
  )

  const handleOrderChange = (orderId: string) => {
    setPurchaseOrderId(orderId)
    const nextOrder = availableOrders.find((order) => order.id === orderId)
    setLines(nextOrder ? buildInitialLines(nextOrder) : [])
  }

  const updateReceiveNow = (purchaseOrderLineId: string, receiveNow: string) => {
    setLines((previous) =>
      previous.map((line) => (line.purchaseOrderLineId === purchaseOrderLineId ? { ...line, receiveNow } : line))
    )
  }

  const normalizedLines = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        receiveNowValue: toNum(line.receiveNow),
        lineTotal: toCurrency(toNum(line.receiveNow) * line.unitPrice),
      })),
    [lines]
  )

  const selectedReceiptLines = useMemo(
    () => normalizedLines.filter((line) => line.receiveNowValue > QUANTITY_TOLERANCE),
    [normalizedLines]
  )
  const totalPoBalanceQuantity = useMemo(
    () => normalizedLines.reduce((sum, line) => sum + line.quantityRemaining, 0),
    [normalizedLines]
  )
  const totalReceiveNowQuantity = useMemo(
    () => selectedReceiptLines.reduce((sum, line) => sum + line.receiveNowValue, 0),
    [selectedReceiptLines]
  )

  const receiptSubtotal = useMemo(
    () => toCurrency(selectedReceiptLines.reduce((sum, line) => sum + line.lineTotal, 0)),
    [selectedReceiptLines]
  )

  const willBeFullyReceived = useMemo(() => {
    if (!selectedOrder) {
      return false
    }

    return normalizedLines.every((line) => line.quantityRemaining - line.receiveNowValue <= QUANTITY_TOLERANCE)
  }, [normalizedLines, selectedOrder])

  const discount = useMemo(() => {
    if (!selectedOrder) {
      return 0
    }

    if (willBeFullyReceived) {
      return toCurrency(Math.max(0, selectedOrder.discount - selectedOrder.allocatedDiscount))
    }

    if (selectedOrder.subtotal <= 0) {
      return 0
    }

    return toCurrency((selectedOrder.discount * receiptSubtotal) / selectedOrder.subtotal)
  }, [receiptSubtotal, selectedOrder, willBeFullyReceived])

  const taxableBase = useMemo(() => toCurrency(Math.max(0, receiptSubtotal - discount)), [discount, receiptSubtotal])

  const vatAmount = useMemo(() => {
    if (!selectedOrder?.applyVat) {
      return 0
    }

    if (willBeFullyReceived) {
      return toCurrency(Math.max(0, selectedOrder.vatAmount - selectedOrder.allocatedVatAmount))
    }

    return toCurrency(taxableBase * 0.12)
  }, [selectedOrder, taxableBase, willBeFullyReceived])

  const grandTotal = useMemo(() => toCurrency(taxableBase + vatAmount), [taxableBase, vatAmount])

  const handleCreate = () => {
    if (!purchaseOrderId) {
      toast.error("Select an open purchase order.")
      return
    }

    if (selectedReceiptLines.length === 0) {
      toast.error("Enter at least one received quantity greater than zero.")
      return
    }

    for (const line of normalizedLines) {
      if (line.receiveNowValue < 0) {
        toast.error(`Line ${line.lineNumber}: received quantity cannot be negative.`)
        return
      }

      if (line.receiveNowValue - line.quantityRemaining > QUANTITY_TOLERANCE) {
        toast.error(`Line ${line.lineNumber}: received quantity exceeds the remaining PO quantity.`)
        return
      }
    }

    startTransition(async () => {
      const result = await createPurchaseOrderGoodsReceiptAction({
        companyId,
        purchaseOrderId,
        receivedAt,
        remarks: remarks.trim() || undefined,
        lines: selectedReceiptLines.map((line) => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          receivedQuantity: line.receiveNowValue,
        })),
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      if (result.goodsReceiptId) {
        router.push(`/${companyId}/employee-portal/goods-receipt-pos/${result.goodsReceiptId}`)
      } else {
        router.push(`/${companyId}/employee-portal/goods-receipt-pos`)
      }
      router.refresh()
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Employee Self-Service</p>
            <div className="flex items-center gap-4">
              <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                <IconReceipt2 className="size-5 text-primary" />
                Create Goods Receipt PO
              </h1>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                PO {"->"} GRPO
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Receive actual delivered quantities against an open purchase order. Partial receipts are allowed. The PO closes automatically when all lines are fully received.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-[auto_auto]">
            <Button type="button" variant="outline" className="justify-self-start rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/goods-receipt-pos`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to GRPO List
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  disabled={isPending || availableOrders.length === 0}
                  className="justify-self-start rounded-lg"
                >
                  {isPending ? "Creating..." : "Create Goods Receipt PO"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base font-semibold">Create Goods Receipt PO</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will post the received quantities to the selected purchase order and update PO receiving status.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-lg">Back</AlertDialogCancel>
                  <AlertDialogAction className="rounded-lg" onClick={handleCreate} disabled={isPending}>
                    Confirm Create
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {availableOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 py-16">
            <IconClipboardList className="size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground/60">No open purchase orders available</p>
            <p className="max-w-xs text-center text-xs text-muted-foreground/40">
              All current purchase orders are already fully received or no receivable quantities remain.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 rounded-lg">
              <Link href={`/${companyId}/employee-portal/purchase-orders`}>Back to Purchase Orders</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="border-y border-border/60 bg-muted/10">
              <div className="grid grid-cols-2 gap-0 md:grid-cols-4">
                {[
                  { label: "Source PO", value: selectedOrder?.poNumber ?? "-" },
                  { label: "Receipt Lines", value: `${selectedReceiptLines.length} of ${lines.length}` },
                  { label: "Receipt Subtotal", value: `PHP ${currency.format(receiptSubtotal)}` },
                  { label: "Grand Total", value: `PHP ${currency.format(grandTotal)}` },
                ].map((item, index) => (
                  <div key={item.label} className={`px-3 py-3 ${index > 0 ? "border-l border-border/60" : ""}`}>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="border border-border/60 bg-muted/10 px-4 py-4 sm:px-5 sm:py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">
                    Source Purchase Order <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={orderOpen} onOpenChange={setOrderOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={orderOpen}
                        disabled={isPending}
                        className={cn("w-full justify-between font-normal", !purchaseOrderId && "text-muted-foreground")}
                      >
                        <span className="truncate">{selectedOrder ? selectedOrder.poNumber : "Select purchase order"}</span>
                        <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] rounded-lg border-border/60 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search purchase orders..." />
                        <CommandList>
                          <CommandEmpty>No purchase orders found.</CommandEmpty>
                          <CommandGroup>
                            {availableOrders.map((order) => (
                              <CommandItem
                                key={order.id}
                                value={`${order.poNumber} ${order.supplierName} ${order.sourceRequestNumber}`}
                                onSelect={() => {
                                  handleOrderChange(order.id)
                                  setOrderOpen(false)
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">{order.poNumber}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {order.supplierName} • {order.sourceRequestNumber}
                                  </span>
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
                  <Label className="text-xs text-foreground">GRPO Number</Label>
                  <Input value={nextGrpoNumber} readOnly className="bg-muted/40 text-muted-foreground font-medium tracking-tight" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-foreground">
                    Received Date <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        className={cn("w-full justify-start text-left font-normal", !receivedAt && "text-muted-foreground")}
                      >
                        <IconCalendar className="mr-2 h-4 w-4" />
                        {receivedAt || "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parsePhDateInputToPhDate(receivedAt) ?? undefined}
                        onSelect={(date) => setReceivedAt(date ? toPhDateInputValue(date) : "")}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {selectedOrder ? (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Source PO Status</p>
                    <Badge variant={statusVariant(selectedOrder.purchaseOrderStatus)} className="text-[10px]">
                      {toStatusLabel(selectedOrder.purchaseOrderStatus)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <IconUser className="size-3" />Requester
                      </p>
                      <p className="text-xs font-medium text-foreground">{selectedOrder.requesterName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <IconBuilding className="size-3" />Department
                      </p>
                      <p className="text-xs font-medium text-foreground">{selectedOrder.departmentName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <IconMapPin className="size-3" />Branch
                      </p>
                      <p className="text-xs font-medium text-foreground">{selectedOrder.requesterBranchName ?? "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">Supplier</p>
                      <p className="text-xs font-medium text-foreground">{selectedOrder.supplierName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">Payment Terms</p>
                      <p className="text-xs font-medium text-foreground">{selectedOrder.paymentTerms}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Source PO status reflects the whole purchase order. This receipt can be complete while the source PO remains partially received.
                  </p>
                </div>
              ) : null}
            </div>

            {selectedOrder ? (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="overflow-hidden border border-border/60">
                    <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <IconReceipt2 className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Receivable PO Line Items</h3>
                      </div>
                      <Badge variant={willBeFullyReceived ? "default" : "outline"} className="text-[10px]">
                        {willBeFullyReceived ? "Final Receipt" : "Partial Receipt"}
                      </Badge>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="grid min-w-[1020px] grid-cols-[3rem_7rem_minmax(0,1.35fr)_4.5rem_5rem_5rem_5rem_6rem_6rem_minmax(0,1fr)] items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <p>#</p>
                        <p>Item Code</p>
                        <p>Description</p>
                        <p>UOM</p>
                        <p className="text-right">Ordered</p>
                        <p className="text-right">Prev Received</p>
                        <p className="text-right">PO Balance</p>
                        <p className="text-right">Receive Now</p>
                        <p className="text-right">Line Total</p>
                        <p>Remarks</p>
                      </div>

                      <div className="max-h-[28rem] overflow-y-auto">
                        {normalizedLines.map((line) => (
                          <div
                            key={line.purchaseOrderLineId}
                            className="grid min-w-[1020px] grid-cols-[3rem_7rem_minmax(0,1.35fr)_4.5rem_5rem_5rem_5rem_6rem_6rem_minmax(0,1fr)] items-center gap-2 border-b border-border/60 px-3 py-2 text-xs last:border-b-0"
                          >
                            <p className="text-muted-foreground">{line.lineNumber}</p>
                            <p className="truncate text-foreground">{line.itemCode || "-"}</p>
                            <p className="truncate text-foreground" title={line.description}>
                              {line.description}
                            </p>
                            <p className="truncate text-foreground">{line.uom}</p>
                            <p className="text-right tabular-nums text-foreground">{quantity.format(line.quantityOrdered)}</p>
                            <p className="text-right tabular-nums text-foreground">{quantity.format(line.quantityReceived)}</p>
                            <p className="text-right tabular-nums text-foreground">{quantity.format(line.quantityRemaining)}</p>
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              max={line.quantityRemaining}
                              value={line.receiveNow}
                              onChange={(event) => updateReceiveNow(line.purchaseOrderLineId, event.target.value)}
                              className="h-8 text-right tabular-nums"
                              disabled={isPending}
                            />
                            <p className="text-right tabular-nums text-foreground">{currency.format(line.lineTotal)}</p>
                            <p className="truncate text-foreground" title={line.remarks || undefined}>
                              {line.remarks || "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2 border border-border/60 p-4">
                      <Label className="text-xs text-foreground">Receiving Notes</Label>
                      <Textarea
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        placeholder="Notes for this goods receipt"
                        className="min-h-[96px] resize-none rounded-lg"
                        disabled={isPending}
                      />
                    </div>

                    <div className="space-y-3 border border-border/60 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Receipt Totals</p>
                        {selectedOrder.applyVat ? (
                          <Badge variant="outline" className="text-[10px]">VAT Enabled</Badge>
                        ) : null}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">PO Balance Qty</span>
                          <span className="font-medium text-foreground">{quantity.format(totalPoBalanceQuantity)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Receive Now Qty</span>
                          <span className="font-medium text-foreground">{quantity.format(totalReceiveNowQuantity)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium text-foreground">PHP {currency.format(receiptSubtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Discount</span>
                          <span className="font-medium text-foreground">PHP {currency.format(discount)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">VAT (12%)</span>
                          <span className="font-medium text-foreground">PHP {currency.format(vatAmount)}</span>
                        </div>
                        <div className="border-t border-border/60 pt-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-base font-semibold text-foreground">Grand Total</span>
                            <span className="text-base font-semibold text-foreground">PHP {currency.format(grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Discount is applied before VAT. When this receipt completes the PO, any remaining unapplied PO discount and VAT are assigned here automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
