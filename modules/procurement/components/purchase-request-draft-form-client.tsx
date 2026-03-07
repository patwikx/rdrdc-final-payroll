"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { IconArrowLeft, IconCalendar, IconFileInvoice, IconPackage, IconTrash } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import {
  createPurchaseRequestDraftAction,
  submitPurchaseRequestAction,
  updatePurchaseRequestDraftAction,
} from "@/modules/procurement/actions/purchase-request-actions"
import {
  type PurchaseRequestExistingItemSelection,
  PurchaseRequestExistingItemsDialog,
} from "@/modules/procurement/components/purchase-request-existing-items-dialog"
import type {
  PurchaseRequestDepartmentFlowPreview,
  PurchaseRequestDepartmentOption,
  PurchaseRequestRow,
} from "@/modules/procurement/types/purchase-request-types"
import type { MaterialRequestSeries, MaterialRequestType } from "@prisma/client"

type PurchaseRequestDraftFormClientProps = {
  companyId: string
  departments: PurchaseRequestDepartmentOption[]
  departmentFlowPreviews: PurchaseRequestDepartmentFlowPreview[]
  requestNumberPreviewBySeries: Record<MaterialRequestSeries, string>
  requesterBranchName?: string | null
  initialRequest?: PurchaseRequestRow | null
}

type PurchaseRequestItemForm = {
  id: string
  source: "CATALOG"
  procurementItemId: string | null
  itemCode: string
  description: string
  uom: string
  quantity: string
  unitPrice: string
  remarks: string
}

type PurchaseRequestFormState = {
  series: MaterialRequestSeries
  requestType: MaterialRequestType
  datePrepared: string
  dateRequired: string
  departmentId: string
  selectedStepApproverUserIds: [string, string, string, string]
  purpose: string
  remarks: string
  deliverTo: string
  items: PurchaseRequestItemForm[]
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const MAX_UNIT_PRICE = 999999.99

const createInitialFormState = (
  defaultDepartmentId?: string,
  defaultSelectedStepApproverUserIds?: [string, string, string, string]
): PurchaseRequestFormState => {
  const today = toPhDateInputValue(new Date())

  return {
    series: "PO",
    requestType: "ITEM",
    datePrepared: today,
    dateRequired: today,
    departmentId: defaultDepartmentId ?? "",
    selectedStepApproverUserIds: defaultSelectedStepApproverUserIds ?? ["", "", "", ""],
    purpose: "",
    remarks: "",
    deliverTo: "",
    items: [],
  }
}

const mapRequestToFormState = (request: PurchaseRequestRow): PurchaseRequestFormState => ({
  series: request.series,
  requestType: request.requestType,
  datePrepared: request.datePreparedValue,
  dateRequired: request.dateRequiredValue,
  departmentId: request.departmentId,
  selectedStepApproverUserIds: [
    request.selectedInitialApproverUserId ?? "",
    request.selectedStepTwoApproverUserId ?? "",
    request.selectedStepThreeApproverUserId ?? "",
    request.selectedStepFourApproverUserId ?? "",
  ],
  purpose: request.purpose ?? "",
  remarks: request.remarks ?? "",
  deliverTo: request.deliverTo ?? "",
  items:
    request.items.length > 0
      ? request.items.map((item) => ({
          id: item.id,
          source: "CATALOG",
          procurementItemId: item.procurementItemId ?? "",
          itemCode: item.itemCode ?? "",
          description: item.description,
          uom: item.uom,
          quantity: String(item.quantity),
          unitPrice: item.unitPrice === null ? "" : String(item.unitPrice),
          remarks: item.remarks ?? "",
        }))
      : [],
})

const toInputNumber = (value: string): number => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return numeric
}

const toLimitedUnitPriceInput = (value: string): string => {
  if (value.trim().length === 0) {
    return ""
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return ""
  }

  return numeric > MAX_UNIT_PRICE ? String(MAX_UNIT_PRICE) : value
}

const normalizeProcurementItemId = (value: string | null | undefined): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

const computeLineTotal = (item: PurchaseRequestItemForm): number => {
  const quantity = toInputNumber(item.quantity)
  const unitPrice = toInputNumber(item.unitPrice)

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return 0
  }

  return quantity * unitPrice
}

const computePreviewTotals = (form: PurchaseRequestFormState): { subTotal: number; grandTotal: number } => {
  const subTotal = form.items.reduce((sum, item) => sum + computeLineTotal(item), 0)
  const grandTotal = subTotal

  return {
    subTotal,
    grandTotal,
  }
}

const getDefaultStepApproverUserIdsForDepartment = (
  departmentFlowPreviews: PurchaseRequestDepartmentFlowPreview[],
  departmentId: string
): [string, string, string, string] => {
  const flow = departmentFlowPreviews.find((item) => item.departmentId === departmentId)
  if (!flow) {
    return ["", "", "", ""]
  }

  return [
    flow.approversByStep.find((step) => step.stepNumber === 1)?.approvers[0]?.userId ?? "",
    flow.approversByStep.find((step) => step.stepNumber === 2)?.approvers[0]?.userId ?? "",
    flow.approversByStep.find((step) => step.stepNumber === 3)?.approvers[0]?.userId ?? "",
    flow.approversByStep.find((step) => step.stepNumber === 4)?.approvers[0]?.userId ?? "",
  ]
}

const getStepDisplayName = (
  flow: PurchaseRequestDepartmentFlowPreview | null,
  stepNumber: number
): string => {
  return flow?.approversByStep.find((step) => step.stepNumber === stepNumber)?.stepName ?? `Step ${stepNumber}`
}

export function PurchaseRequestDraftFormClient({
  companyId,
  departments,
  departmentFlowPreviews,
  requestNumberPreviewBySeries,
  requesterBranchName = null,
  initialRequest = null,
}: PurchaseRequestDraftFormClientProps) {
  const router = useRouter()
  const isEditing = Boolean(initialRequest)
  const canSubmitFromForm = initialRequest?.status === "DRAFT" || !initialRequest

  const defaultDepartmentId = departments.find((department) => department.isActive)?.id ?? departments[0]?.id ?? ""
  const defaultSelectedStepApproverUserIds = getDefaultStepApproverUserIdsForDepartment(
    departmentFlowPreviews,
    defaultDepartmentId
  )

  const [isPending, startTransition] = useTransition()
  const [isExistingItemsDialogOpen, setIsExistingItemsDialogOpen] = useState(false)
  const [form, setForm] = useState<PurchaseRequestFormState>(() =>
    initialRequest
      ? mapRequestToFormState(initialRequest)
      : createInitialFormState(defaultDepartmentId, defaultSelectedStepApproverUserIds)
  )

  const displayedRequestNumber = initialRequest?.requestNumber ?? requestNumberPreviewBySeries[form.series]
  const displayedRequesterBranchName = initialRequest?.requesterBranchName ?? requesterBranchName ?? ""
  const previewTotals = useMemo(() => computePreviewTotals(form), [form])
  const selectedDepartmentFlowPreview = useMemo(() => {
    if (!form.departmentId) {
      return null
    }

    return departmentFlowPreviews.find((flow) => flow.departmentId === form.departmentId) ?? null
  }, [departmentFlowPreviews, form.departmentId])
  const selectedDepartmentRequiredSteps = selectedDepartmentFlowPreview?.requiredSteps ?? 0

  const getApproverOptionsForStep = (stepNumber: number) => {
    if (!selectedDepartmentFlowPreview) {
      return []
    }

    return selectedDepartmentFlowPreview.approversByStep.find((step) => step.stepNumber === stepNumber)?.approvers ?? []
  }

  const visibleApproverStepNumbers = Array.from({ length: 4 }, (_, index) => index + 1).filter(
    (stepNumber) => getApproverOptionsForStep(stepNumber).length > 0
  )

  const updateItem = (itemId: string, patch: Partial<PurchaseRequestItemForm>) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }))
  }

  const addExistingItems = (selectedItems: PurchaseRequestExistingItemSelection[]) => {
    setForm((previous) => {
      const existingProcurementItemIds = new Set(
        previous.items
          .map((item) => normalizeProcurementItemId(item.procurementItemId))
          .filter((procurementItemId) => procurementItemId.length > 0)
      )

      const appendedItems: PurchaseRequestItemForm[] = []
      let skippedCount = 0

      for (const selectedItem of selectedItems) {
        if (existingProcurementItemIds.has(selectedItem.procurementItemId)) {
          skippedCount += 1
          continue
        }

        existingProcurementItemIds.add(selectedItem.procurementItemId)
        appendedItems.push({
          id: crypto.randomUUID(),
          source: "CATALOG",
          procurementItemId: selectedItem.procurementItemId,
          itemCode: selectedItem.itemCode.trim().toUpperCase(),
          description: selectedItem.description,
          uom: selectedItem.uom,
          quantity: selectedItem.quantity,
          unitPrice: selectedItem.unitPrice,
          remarks: selectedItem.remarks,
        })
      }

      if (appendedItems.length === 0) {
        toast.error("Selected items were already added.")
        return previous
      }

      if (skippedCount > 0) {
        toast.success(
          `${appendedItems.length} item${appendedItems.length === 1 ? "" : "s"} added. ${skippedCount} already in the request.`
        )
      }

      return {
        ...previous,
        items: [...previous.items, ...appendedItems],
      }
    })
  }

  const removeItem = (itemId: string) => {
    setForm((previous) => {
      return {
        ...previous,
        items: previous.items.filter((item) => item.id !== itemId),
      }
    })
  }

  const normalizePayload = () => {
    return {
      companyId,
      series: form.series,
      requestType: form.requestType,
      datePrepared: form.datePrepared,
      dateRequired: form.dateRequired,
      departmentId: form.departmentId,
      ...(form.selectedStepApproverUserIds[0]
        ? { selectedInitialApproverUserId: form.selectedStepApproverUserIds[0] }
        : {}),
      ...(form.selectedStepApproverUserIds[1]
        ? { selectedStepTwoApproverUserId: form.selectedStepApproverUserIds[1] }
        : {}),
      ...(form.selectedStepApproverUserIds[2]
        ? { selectedStepThreeApproverUserId: form.selectedStepApproverUserIds[2] }
        : {}),
      ...(form.selectedStepApproverUserIds[3]
        ? { selectedStepFourApproverUserId: form.selectedStepApproverUserIds[3] }
        : {}),
      purpose: form.purpose,
      remarks: form.remarks,
      deliverTo: form.deliverTo,
      items: form.items
        .filter((item) => normalizeProcurementItemId(item.procurementItemId).length > 0)
        .map((item) => ({
          source: item.source,
          procurementItemId: normalizeProcurementItemId(item.procurementItemId),
          itemCode: item.itemCode,
          description: item.description,
          uom: item.uom,
          quantity: toInputNumber(item.quantity),
          unitPrice: item.unitPrice.trim().length > 0 ? toInputNumber(item.unitPrice) : undefined,
          remarks: item.remarks,
        })),
    }
  }

  const handleSaveDraft = () => {
    if (!form.departmentId) {
      toast.error("Department is required.")
      return
    }

    if (
      form.items.length === 0 ||
      form.items.some((item) => normalizeProcurementItemId(item.procurementItemId).length === 0)
    ) {
      toast.error("Add at least one existing catalog item.")
      return
    }

    if (selectedDepartmentRequiredSteps > 0) {
      for (let index = 0; index < selectedDepartmentRequiredSteps; index += 1) {
        const stepNumber = index + 1
        const stepOptions = getApproverOptionsForStep(stepNumber)
        if (stepOptions.length === 0) {
          continue
        }

        if (!form.selectedStepApproverUserIds[index]) {
          toast.error(`${getStepDisplayName(selectedDepartmentFlowPreview, stepNumber)} selection is required.`)
          return
        }
      }
    }

    startTransition(async () => {
      const payload = normalizePayload()

      const response = isEditing && initialRequest
        ? await updatePurchaseRequestDraftAction({ ...payload, requestId: initialRequest.id })
        : await createPurchaseRequestDraftAction(payload)

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      router.push(`/${companyId}/employee-portal/purchase-requests`)
      router.refresh()
    })
  }

  const handleSubmit = () => {
    if (!form.departmentId) {
      toast.error("Department is required.")
      return
    }

    if (
      form.items.length === 0 ||
      form.items.some((item) => normalizeProcurementItemId(item.procurementItemId).length === 0)
    ) {
      toast.error("Add at least one existing catalog item.")
      return
    }

    if (selectedDepartmentRequiredSteps > 0) {
      for (let index = 0; index < selectedDepartmentRequiredSteps; index += 1) {
        const stepNumber = index + 1
        const stepOptions = getApproverOptionsForStep(stepNumber)
        if (stepOptions.length === 0) {
          continue
        }

        if (!form.selectedStepApproverUserIds[index]) {
          toast.error(`${getStepDisplayName(selectedDepartmentFlowPreview, stepNumber)} selection is required.`)
          return
        }
      }
    }

    startTransition(async () => {
      const payload = normalizePayload()
      let requestId = initialRequest?.id

      if (!requestId) {
        const created = await createPurchaseRequestDraftAction(payload)
        if (!created.ok) {
          toast.error(created.error)
          return
        }

        requestId = created.requestId
      } else {
        const updated = await updatePurchaseRequestDraftAction({ ...payload, requestId })
        if (!updated.ok) {
          toast.error(updated.error)
          return
        }
      }

      if (!requestId) {
        toast.error("Unable to resolve purchase request ID for submission.")
        return
      }

      const submitted = await submitPurchaseRequestAction({
        companyId,
        requestId,
      })

      if (!submitted.ok) {
        toast.error(submitted.error)
        return
      }

      toast.success(submitted.message)
      router.push(`/${companyId}/employee-portal/purchase-requests`)
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
                <IconFileInvoice className="size-5 text-primary" />
                {isEditing ? "Edit Purchase Request" : "Create Purchase Request"}
              </h1>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                PR
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Request No. {displayedRequestNumber}. Add items from global item catalog.
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 md:w-auto md:grid-cols-[auto_auto_auto]">
            <Button type="button" variant="outline" className="justify-self-start rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/purchase-requests`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to List
              </Link>
            </Button>
            <Button type="button" variant="outline" className="justify-self-start rounded-lg" disabled={isPending} onClick={handleSaveDraft}>
              {isPending ? "Saving..." : "Save Draft"}
            </Button>
            {canSubmitFromForm ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" className="justify-self-start rounded-lg" disabled={isPending}>
                    {isPending ? "Submitting..." : "Save and Submit"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base font-semibold">Save and Submit Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Please review this purchase request carefully before submitting. It will proceed to the approval workflow.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg">Review again</AlertDialogCancel>
                    <AlertDialogAction className="rounded-lg" onClick={handleSubmit} disabled={isPending}>
                      Save and Submit
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">
              Series <Required />
            </Label>
            <Select value={form.series} onValueChange={(value) => setForm((previous) => ({ ...previous, series: value as MaterialRequestSeries }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PO">PO</SelectItem>
                <SelectItem value="JO">JO</SelectItem>
                <SelectItem value="OTHERS">OTHERS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-foreground">
              Request Type <Required />
            </Label>
            <Select
              value={form.requestType}
              onValueChange={(value) => setForm((previous) => ({ ...previous, requestType: value as MaterialRequestType }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ITEM">ITEM</SelectItem>
                <SelectItem value="SERVICE">SERVICE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-foreground">Request Number</Label>
            <Input value={displayedRequestNumber} readOnly className="bg-muted/40 text-muted-foreground font-medium tracking-tight" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-foreground">
              Date Prepared <Required />
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {form.datePrepared || "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto rounded-lg border-border/60 p-0">
                <Calendar
                  mode="single"
                  selected={parsePhDateInputToPhDate(form.datePrepared) ?? undefined}
                  onSelect={(value) => {
                    if (!value) {
                      return
                    }

                    setForm((previous) => ({
                      ...previous,
                      datePrepared: toPhDateInputValue(value),
                    }))
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-foreground">
              Date Required <Required />
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {form.dateRequired || "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto rounded-lg border-border/60 p-0">
                <Calendar
                  mode="single"
                  selected={parsePhDateInputToPhDate(form.dateRequired) ?? undefined}
                  onSelect={(value) => {
                    if (!value) {
                      return
                    }

                    setForm((previous) => ({
                      ...previous,
                      dateRequired: toPhDateInputValue(value),
                    }))
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Branch</Label>
            <Input value={displayedRequesterBranchName || "-"} readOnly className="bg-muted/40 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-foreground">
              Charge To <Required />
            </Label>
            <Select
              value={form.departmentId}
              onValueChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  departmentId: value,
                  selectedStepApproverUserIds: getDefaultStepApproverUserIdsForDepartment(
                    departmentFlowPreviews,
                    value
                  ),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                    {!department.isActive ? " (Inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visibleApproverStepNumbers.map((stepNumber) => {
            const stepIndex = stepNumber - 1
            const options = getApproverOptionsForStep(stepNumber)
            const isRequiredStep = stepNumber <= selectedDepartmentRequiredSteps
            const stepDisplayName = getStepDisplayName(selectedDepartmentFlowPreview, stepNumber)

            return (
              <div key={stepNumber} className="space-y-2">
                <Label className="text-xs text-foreground">
                  {stepDisplayName}
                  {isRequiredStep ? <Required /> : null}
                </Label>
                <Select
                  value={form.selectedStepApproverUserIds[stepIndex] || "__UNSET__"}
                  onValueChange={(value) =>
                    setForm((previous) => {
                      const nextSelectedStepApproverUserIds = [
                        ...previous.selectedStepApproverUserIds,
                      ] as [string, string, string, string]
                      nextSelectedStepApproverUserIds[stepIndex] = value === "__UNSET__" ? "" : value

                      return {
                        ...previous,
                        selectedStepApproverUserIds: nextSelectedStepApproverUserIds,
                      }
                    })
                  }
                >
                  <SelectTrigger className="w-full" disabled={!form.departmentId}>
                    <SelectValue placeholder={`Select ${stepDisplayName}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__UNSET__">Select approver</SelectItem>
                    {options.map((approver) => (
                      <SelectItem key={approver.userId} value={approver.userId}>
                        {approver.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}

          <div className="space-y-2">
            <Label className="text-xs text-foreground">Deliver To</Label>
            <Input
              value={form.deliverTo}
              onChange={(event) => setForm((previous) => ({ ...previous, deliverTo: event.target.value }))}
              placeholder="Receiver / location"
            />
          </div>
        </div>

        {visibleApproverStepNumbers.length === 0 && form.departmentId ? (
          <p className="text-xs text-muted-foreground">
            No active approval flow configured for the selected department.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Purpose</Label>
            <Textarea
              value={form.purpose}
              onChange={(event) => setForm((previous) => ({ ...previous, purpose: event.target.value }))}
              rows={3}
              className="min-h-[90px] resize-none rounded-lg text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-foreground">Remarks</Label>
            <Textarea
              value={form.remarks}
              onChange={(event) => setForm((previous) => ({ ...previous, remarks: event.target.value }))}
              rows={3}
              className="min-h-[90px] resize-none rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60">
          <div className="flex flex-col gap-2 border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <IconPackage className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Request Items</h3>
              <Badge variant="outline" className="ml-1 text-[10px]">
                {form.items.length} item{form.items.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setIsExistingItemsDialogOpen(true)} disabled={isPending}>
                Add Existing Items
              </Button>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto p-2 md:hidden">
            {form.items.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                Add at least one line item.
              </div>
            ) : (
              <div className="space-y-2">
                {form.items.map((item, index) => {
                  const lineTotal = computeLineTotal(item)

                  return (
                    <div key={item.id} className="space-y-2 rounded-lg border border-border/60 p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Line #{index + 1}</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(item.id)} disabled={isPending}>
                              <IconTrash className="size-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>Remove item</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Item Code</Label>
                          <Input value={item.itemCode} readOnly className="bg-muted/40" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">UOM</Label>
                          <Input value={item.uom} readOnly className="bg-muted/40" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Description</Label>
                        <Input value={item.description} readOnly className="bg-muted/40" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Qty <Required />
                          </Label>
                          <Input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={item.quantity}
                            onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            max={MAX_UNIT_PRICE}
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateItem(item.id, { unitPrice: toLimitedUnitPriceInput(event.target.value) })
                            }
                          />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-foreground text-right">PHP {currency.format(lineTotal)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <div className="grid min-w-[920px] grid-cols-[2.25rem_8rem_minmax(0,1.65fr)_4.5rem_5.75rem_6.75rem_7rem_2.5rem] items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <p>#</p>
              <p>Item Code</p>
              <p>Description</p>
              <p>UOM</p>
              <p className="text-right">
                Qty <span className="text-destructive">*</span>
              </p>
              <p className="text-right">Unit Price</p>
              <p className="text-right">Line Total</p>
              <p></p>
            </div>
            <div className="max-h-[22rem] overflow-y-auto">
              {form.items.map((item, index) => {
                const lineTotal = computeLineTotal(item)

                return (
                  <div
                    key={item.id}
                    className="grid min-w-[920px] grid-cols-[2.25rem_8rem_minmax(0,1.65fr)_4.5rem_5.75rem_6.75rem_7rem_2.5rem] items-center gap-2 border-b border-border/60 px-3 py-2 text-xs last:border-b-0"
                  >
                    <p className="text-muted-foreground">{index + 1}</p>
                    <Input value={item.itemCode} readOnly className="bg-muted/40" />
                    <Input value={item.description} readOnly className="bg-muted/40" />
                    <Input value={item.uom} readOnly className="bg-muted/40" />
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                      className="text-right tabular-nums"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      max={MAX_UNIT_PRICE}
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(item.id, { unitPrice: toLimitedUnitPriceInput(event.target.value) })
                      }
                      className="text-right tabular-nums"
                    />
                    <p className="text-right tabular-nums font-medium text-foreground">PHP {currency.format(lineTotal)}</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeItem(item.id)}
                          disabled={isPending}
                          className="justify-self-end"
                        >
                          <IconTrash className="size-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6}>Remove item</TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-t border-border/60 bg-muted/10 px-4 py-3">
            <div className="flex items-end justify-end">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Subtotal</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">PHP {currency.format(previewTotals.subTotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-primary/80">Grand Total</p>
                  <p className="text-base font-bold text-primary tabular-nums">PHP {currency.format(previewTotals.grandTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PurchaseRequestExistingItemsDialog
        companyId={companyId}
        open={isExistingItemsDialogOpen}
        onOpenChange={setIsExistingItemsDialogOpen}
        onItemsSelected={addExistingItems}
      />
    </div>
  )
}
