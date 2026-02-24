"use client"

import { useMemo, useState, useTransition } from "react"
import { IconArrowLeft, IconPackage, IconPlus, IconTrash } from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import {
  createMaterialRequestDraftAction,
  submitMaterialRequestAction,
  updateMaterialRequestDraftAction,
} from "@/modules/material-requests/actions/material-request-actions"
import {
  type ExistingCatalogItemSelection,
  MaterialRequestExistingItemsDialog,
} from "@/modules/material-requests/components/material-request-existing-items-dialog"
import type {
  EmployeePortalMaterialRequestDepartmentFlowPreview,
  EmployeePortalMaterialRequestDepartmentOption,
  EmployeePortalMaterialRequestItemRow,
  EmployeePortalMaterialRequestRow,
} from "@/modules/material-requests/types/employee-portal-material-request-types"
import type { MaterialRequestItemSource, MaterialRequestSeries, MaterialRequestType } from "@prisma/client"

type MaterialRequestDraftFormClientProps = {
  companyId: string
  departments: EmployeePortalMaterialRequestDepartmentOption[]
  departmentFlowPreviews: EmployeePortalMaterialRequestDepartmentFlowPreview[]
  requestNumberPreviewBySeries: Record<MaterialRequestSeries, string>
  initialRequest?: EmployeePortalMaterialRequestRow | null
}

type MaterialRequestItemForm = {
  id: string
  source: MaterialRequestItemSource
  itemCode: string
  description: string
  uom: string
  quantity: string
  unitPrice: string
  remarks: string
}

type MaterialRequestFormState = {
  series: MaterialRequestSeries
  requestType: MaterialRequestType
  datePrepared: string
  dateRequired: string
  chargeToDepartmentId: string
  selectedStepApproverUserIds: [string, string, string, string]
  bldgCode: string
  purpose: string
  remarks: string
  deliverTo: string
  isStoreUse: boolean
  freight: string
  discount: string
  items: MaterialRequestItemForm[]
}

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const AUTO_ITEM_CODE_PREFIX = "ITM"
const AUTO_ITEM_CODE_PADDING = 4

const formatAutoItemCode = (sequence: number): string => {
  return `${AUTO_ITEM_CODE_PREFIX}-${String(sequence).padStart(AUTO_ITEM_CODE_PADDING, "0")}`
}

const parseAutoItemCodeSequence = (itemCode: string): number => {
  const matched = itemCode.trim().match(new RegExp(`^${AUTO_ITEM_CODE_PREFIX}-(\\d+)$`, "i"))
  if (!matched) {
    return 0
  }

  const parsed = Number(matched[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const getNextAutoItemCode = (items: MaterialRequestItemForm[]): string => {
  const maxAutoSequence = items.reduce((max, item) => {
    return Math.max(max, parseAutoItemCodeSequence(item.itemCode))
  }, 0)

  const nextSequence = maxAutoSequence > 0 ? maxAutoSequence + 1 : items.length + 1
  return formatAutoItemCode(nextSequence)
}

const createEmptyItem = (itemCode: string): MaterialRequestItemForm => ({
  id: crypto.randomUUID(),
  source: "MANUAL",
  itemCode,
  description: "",
  uom: "",
  quantity: "1",
  unitPrice: "",
  remarks: "",
})

const createInitialFormState = (
  defaultDepartmentId?: string,
  defaultSelectedStepApproverUserIds?: [string, string, string, string]
): MaterialRequestFormState => {
  const today = toPhDateInputValue(new Date())

  return {
    series: "PO",
    requestType: "ITEM",
    datePrepared: today,
    dateRequired: today,
    chargeToDepartmentId: defaultDepartmentId ?? "",
    selectedStepApproverUserIds: defaultSelectedStepApproverUserIds ?? ["", "", "", ""],
    bldgCode: "",
    purpose: "",
    remarks: "",
    deliverTo: "",
    isStoreUse: false,
    freight: "0",
    discount: "0",
    items: [createEmptyItem(formatAutoItemCode(1))],
  }
}

const toInputNumber = (value: string): number => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return numeric
}

const formatOptionalNumberInput = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return ""
  }

  return String(value)
}

const truncateWithDots = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}

const mapRequestItemToFormItem = (item: EmployeePortalMaterialRequestItemRow): MaterialRequestItemForm => ({
  id: item.id,
  source: item.source,
  itemCode: item.itemCode ?? "",
  description: item.description,
  uom: item.uom,
  quantity: String(item.quantity),
  unitPrice: formatOptionalNumberInput(item.unitPrice),
  remarks: item.remarks ?? "",
})

const mapRequestToFormState = (request: EmployeePortalMaterialRequestRow): MaterialRequestFormState => ({
  series: request.series,
  requestType: request.requestType,
  datePrepared: request.datePreparedValue,
  dateRequired: request.dateRequiredValue,
  chargeToDepartmentId: request.departmentId,
  selectedStepApproverUserIds: [
    request.selectedInitialApproverUserId ?? "",
    request.selectedStepTwoApproverUserId ?? "",
    request.selectedStepThreeApproverUserId ?? "",
    request.selectedStepFourApproverUserId ?? "",
  ],
  bldgCode: request.bldgCode ?? "",
  purpose: request.purpose ?? "",
  remarks: request.remarks ?? "",
  deliverTo: request.deliverTo ?? "",
  isStoreUse: request.isStoreUse,
  freight: String(request.freight),
  discount: String(request.discount),
  items:
    request.items.length > 0
      ? request.items.map(mapRequestItemToFormItem)
      : [createEmptyItem(formatAutoItemCode(1))],
})

const computeLineTotal = (item: MaterialRequestItemForm): number => {
  const quantity = toInputNumber(item.quantity)
  const unitPrice = toInputNumber(item.unitPrice)

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return 0
  }

  return quantity * unitPrice
}

const isInitialPlaceholderItemRow = (item: MaterialRequestItemForm): boolean => {
  return (
    item.source === "MANUAL" &&
    item.description.trim().length === 0 &&
    item.uom.trim().length === 0 &&
    item.remarks.trim().length === 0 &&
    item.unitPrice.trim().length === 0 &&
    (item.quantity.trim().length === 0 || item.quantity.trim() === "1")
  )
}

const computePreviewTotals = (form: MaterialRequestFormState): { subTotal: number; grandTotal: number } => {
  const subTotal = form.items.reduce((sum, item) => sum + computeLineTotal(item), 0)
  const grandTotal = subTotal + toInputNumber(form.freight) - toInputNumber(form.discount)

  return {
    subTotal,
    grandTotal,
  }
}

const getDefaultStepApproverUserIdsForDepartment = (
  departmentFlowPreviews: EmployeePortalMaterialRequestDepartmentFlowPreview[],
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
  flow: EmployeePortalMaterialRequestDepartmentFlowPreview | null,
  stepNumber: number
): string => {
  return flow?.approversByStep.find((step) => step.stepNumber === stepNumber)?.stepName ?? `Step ${stepNumber}`
}

const NO_ACTIVE_COMPANY_EMPLOYEE_PROFILE_ERROR = "No linked employee profile found in the active company for this account."

export function MaterialRequestDraftFormClient({
  companyId,
  departments,
  departmentFlowPreviews,
  requestNumberPreviewBySeries,
  initialRequest = null,
}: MaterialRequestDraftFormClientProps) {
  const router = useRouter()
  const isEditing = Boolean(initialRequest)
  const isPendingApprovalEdit = initialRequest?.status === "PENDING_APPROVAL"
  const canSubmitFromForm = !isPendingApprovalEdit
  const defaultChargeToDepartmentId =
    departments.find((department) => department.isActive)?.id ?? departments[0]?.id ?? ""
  const defaultSelectedStepApproverUserIds = getDefaultStepApproverUserIdsForDepartment(
    departmentFlowPreviews,
    defaultChargeToDepartmentId
  )

  const [isPending, startTransition] = useTransition()
  const [isMissingEmployeeProfileDialogOpen, setIsMissingEmployeeProfileDialogOpen] = useState(false)
  const [isExistingItemsDialogOpen, setIsExistingItemsDialogOpen] = useState(false)
  const [form, setForm] = useState<MaterialRequestFormState>(() =>
    initialRequest
      ? mapRequestToFormState(initialRequest)
      : createInitialFormState(defaultChargeToDepartmentId, defaultSelectedStepApproverUserIds)
  )
  const displayedRequestNumber = initialRequest?.requestNumber ?? requestNumberPreviewBySeries[form.series]

  const previewTotals = useMemo(() => computePreviewTotals(form), [form])
  const selectedChargeToDepartment = useMemo(() => {
    return departments.find((department) => department.id === form.chargeToDepartmentId) ?? null
  }, [departments, form.chargeToDepartmentId])

  const selectedDepartmentFlowPreview = useMemo(() => {
    if (!form.chargeToDepartmentId) {
      return null
    }

    return (
      departmentFlowPreviews.find((flow) => flow.departmentId === form.chargeToDepartmentId) ?? null
    )
  }, [departmentFlowPreviews, form.chargeToDepartmentId])

  const selectedDepartmentRequiredSteps = selectedDepartmentFlowPreview?.requiredSteps ?? 0

  const getApproverOptionsForStep = (stepNumber: number) => {
    if (!selectedDepartmentFlowPreview) {
      return []
    }

    return (
      selectedDepartmentFlowPreview.approversByStep.find((step) => step.stepNumber === stepNumber)
        ?.approvers ?? []
    )
  }

  const visibleApproverStepNumbers = Array.from({ length: 4 }, (_, index) => index + 1).filter(
    (stepNumber) => getApproverOptionsForStep(stepNumber).length > 0
  )

  const updateItem = (itemId: string, patch: Partial<MaterialRequestItemForm>) => {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }))
  }

  const addItem = () => {
    setForm((previous) => ({
      ...previous,
      items: [...previous.items, createEmptyItem(getNextAutoItemCode(previous.items))],
    }))
  }

  const addExistingItems = (selectedItems: ExistingCatalogItemSelection[]) => {
    const shouldReplaceInitialPlaceholderRow =
      form.items.length === 1 && isInitialPlaceholderItemRow(form.items[0])

    const currentItems = shouldReplaceInitialPlaceholderRow ? [] : form.items
    const existingCodes = new Set(
      currentItems.map((item) => item.itemCode.trim().toUpperCase()).filter((itemCode) => itemCode.length > 0)
    )

    const nextItems: MaterialRequestItemForm[] = []
    let addedCount = 0
    let skippedCount = 0

    for (const selectedItem of selectedItems) {
      const normalizedCode = selectedItem.itemCode.trim().toUpperCase()
      if (!normalizedCode || existingCodes.has(normalizedCode)) {
        skippedCount += 1
        continue
      }

      existingCodes.add(normalizedCode)
      addedCount += 1

      nextItems.push({
        id: crypto.randomUUID(),
        source: "CATALOG",
        itemCode: normalizedCode,
        description: selectedItem.description,
        uom: selectedItem.uom,
        quantity: selectedItem.quantity,
        unitPrice: selectedItem.unitPrice,
        remarks: selectedItem.remarks,
      })
    }

    if (nextItems.length > 0) {
      setForm((previous) => ({
        ...previous,
        items:
          shouldReplaceInitialPlaceholderRow && previous.items.length === 1 && isInitialPlaceholderItemRow(previous.items[0])
            ? nextItems
            : [...previous.items, ...nextItems],
      }))
    }

    if (addedCount > 0) {
      toast.success(`${addedCount} existing item${addedCount === 1 ? "" : "s"} added.`)
    }

    if (skippedCount > 0) {
      toast.warning(`${skippedCount} item${skippedCount === 1 ? "" : "s"} skipped due to duplicate item code.`)
    }
  }

  const removeItem = (itemId: string) => {
    setForm((previous) => {
      if (previous.items.length === 1) {
        return previous
      }

      return {
        ...previous,
        items: previous.items.filter((item) => item.id !== itemId),
      }
    })
  }

  const validateAndBuildItemPayload = (): Array<{
    source: MaterialRequestItemSource
    itemCode?: string
    description: string
    uom: string
    quantity: number
    unitPrice?: number
    remarks?: string
  }> | null => {
    const payloadItems: Array<{
      source: MaterialRequestItemSource
      itemCode?: string
      description: string
      uom: string
      quantity: number
      unitPrice?: number
      remarks?: string
    }> = []

    for (const [index, item] of form.items.entries()) {
      const description = item.description.trim()
      const uom = item.uom.trim()
      const quantity = toInputNumber(item.quantity)
      const unitPriceRaw = item.unitPrice.trim()
      const unitPrice = unitPriceRaw ? toInputNumber(unitPriceRaw) : undefined

      if (!description) {
        toast.error(`Item ${index + 1}: description is required.`)
        return null
      }

      if (!uom) {
        toast.error(`Item ${index + 1}: unit of measure is required.`)
        return null
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error(`Item ${index + 1}: quantity must be greater than zero.`)
        return null
      }

      if (unitPrice !== undefined && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
        toast.error(`Item ${index + 1}: unit price cannot be negative.`)
        return null
      }

      const itemCode = item.itemCode.trim()
      const remarks = item.remarks.trim()

      payloadItems.push({
        source: item.source,
        ...(itemCode ? { itemCode } : {}),
        description,
        uom,
        quantity,
        ...(unitPrice !== undefined ? { unitPrice } : {}),
        ...(remarks ? { remarks } : {}),
      })
    }

    return payloadItems
  }

  const buildDraftPayload = (
    itemsPayload: Array<{
      source: MaterialRequestItemSource
      itemCode?: string
      description: string
      uom: string
      quantity: number
      unitPrice?: number
      remarks?: string
    }>
  ) => ({
    companyId,
    series: form.series,
    requestType: form.requestType,
    datePrepared: form.datePrepared,
    dateRequired: form.dateRequired,
    departmentId: form.chargeToDepartmentId,
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
    ...(selectedChargeToDepartment
      ? { chargeTo: selectedChargeToDepartment.name }
      : {}),
    ...(form.bldgCode.trim() ? { bldgCode: form.bldgCode.trim() } : {}),
    ...(form.purpose.trim() ? { purpose: form.purpose.trim() } : {}),
    ...(form.remarks.trim() ? { remarks: form.remarks.trim() } : {}),
    ...(form.deliverTo.trim() ? { deliverTo: form.deliverTo.trim() } : {}),
    isStoreUse: form.isStoreUse,
    freight: toInputNumber(form.freight),
    discount: toInputNumber(form.discount),
    items: itemsPayload,
  })

  const saveDraft = (submitAfterSave: boolean) => {
    if (submitAfterSave && !canSubmitFromForm) {
      toast.error("This request is already submitted for approval. Use Update Request to save changes.")
      return
    }

    if (!form.datePrepared || !form.dateRequired) {
      toast.error("Prepared date and required date are required.")
      return
    }

    if (!form.chargeToDepartmentId) {
      toast.error("Charge To department is required.")
      return
    }

    if (selectedDepartmentRequiredSteps > 0) {
      for (let index = 0; index < selectedDepartmentRequiredSteps; index += 1) {
        const stepNumber = index + 1
        const stepOptions = getApproverOptionsForStep(stepNumber)
        if (stepOptions.length === 0) {
          continue
        }

        const selectedApproverUserId = form.selectedStepApproverUserIds[index]
        if (!selectedApproverUserId) {
          toast.error(`${getStepDisplayName(selectedDepartmentFlowPreview, stepNumber)} selection is required.`)
          return
        }
      }
    }

    if (form.items.length === 0) {
      toast.error("At least one request item is required.")
      return
    }

    const itemsPayload = validateAndBuildItemPayload()
    if (!itemsPayload) {
      return
    }

    startTransition(async () => {
      const basePayload = buildDraftPayload(itemsPayload)

      const result = initialRequest
        ? await updateMaterialRequestDraftAction({
            requestId: initialRequest.id,
            ...basePayload,
          })
        : await createMaterialRequestDraftAction(basePayload)

      if (!result.ok) {
        if (!initialRequest && result.error === NO_ACTIVE_COMPANY_EMPLOYEE_PROFILE_ERROR) {
          setIsMissingEmployeeProfileDialogOpen(true)
          return
        }

        toast.error(result.error)
        return
      }

      setIsMissingEmployeeProfileDialogOpen(false)

      const savedRequestId = result.requestId ?? initialRequest?.id

      if (!submitAfterSave) {
        toast.success(result.message)
        router.push(`/${companyId}/employee-portal/material-requests`)
        router.refresh()
        return
      }

      if (!savedRequestId) {
        toast.error("Draft saved, but request identifier was not returned. Please open and submit manually.")
        router.push(`/${companyId}/employee-portal/material-requests`)
        router.refresh()
        return
      }

      const submitResult = await submitMaterialRequestAction({
        companyId,
        requestId: savedRequestId,
      })

      if (!submitResult.ok) {
        toast.error(`Draft saved, but submission failed: ${submitResult.error}`)
        if (!initialRequest) {
          router.push(`/${companyId}/employee-portal/material-requests/${savedRequestId}/edit`)
          router.refresh()
        }
        return
      }

      toast.success(submitResult.message)
      router.push(`/${companyId}/employee-portal/material-requests`)
      router.refresh()
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <AlertDialog
        open={isMissingEmployeeProfileDialogOpen}
        onOpenChange={setIsMissingEmployeeProfileDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Employee Profile Required</AlertDialogTitle>
            <AlertDialogDescription>
              No active employee profile is linked to your account in this company. Please contact HR to link your employee record before creating a material request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction type="button">Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Employee Self-Service</p>
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                {!isEditing
                  ? "Create Material Request Draft"
                  : isPendingApprovalEdit
                    ? "Update Pending Material Request"
                    : "Edit Material Request Draft"}
              </h1>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Requisition
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {!isEditing
                ? "Fill in the requisition details and line items. Save as draft before submitting for approval."
                : isPendingApprovalEdit
                  ? "Update request details while approval is still pending with no decision history."
                  : "Update your draft details and submit when ready."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/material-requests`}>
                <IconArrowLeft className="mr-1 h-4 w-4" />
                Back to Requests
              </Link>
            </Button>
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/material-requests`}>Cancel</Link>
            </Button>
            <Button
              type="button"
              variant={isPendingApprovalEdit ? "default" : "outline"}
              onClick={() => saveDraft(false)}
              disabled={isPending}
              className={cn(
                "rounded-lg",
                isPendingApprovalEdit && "bg-violet-600 text-white hover:bg-violet-700"
              )}
            >
              {isPending
                ? "Saving..."
                : !isEditing
                  ? "Save Draft"
                  : isPendingApprovalEdit
                    ? "Update Request"
                    : "Update Draft"}
            </Button>
            {canSubmitFromForm ? (
              <Button type="button" onClick={() => saveDraft(true)} disabled={isPending} className="rounded-lg">
                {isPending ? "Saving..." : "Save & Submit"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="space-y-5">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Series <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.series}
                  onValueChange={(value: MaterialRequestSeries) => setForm((previous) => ({ ...previous, series: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select series" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border/60">
                    <SelectItem value="PO">PO</SelectItem>
                    <SelectItem value="JO">JO</SelectItem>
                    <SelectItem value="OTHERS">OTHERS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">Request No.</Label>
                <Input value={displayedRequestNumber} readOnly className="w-full" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Request Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.requestType}
                  onValueChange={(value: MaterialRequestType) =>
                    setForm((previous) => ({
                      ...previous,
                      requestType: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border/60">
                    <SelectItem value="ITEM">ITEM</SelectItem>
                    <SelectItem value="SERVICE">SERVICE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Date Prepared <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left",
                        !form.datePrepared && "text-muted-foreground"
                      )}
                    >
                      {form.datePrepared || "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parsePhDateInputToPhDate(form.datePrepared) ?? undefined}
                      onSelect={(date) =>
                        setForm((previous) => ({
                          ...previous,
                          datePrepared: toPhDateInputValue(date),
                        }))
                      }
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Date Required <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left",
                        !form.dateRequired && "text-muted-foreground"
                      )}
                    >
                      {form.dateRequired || "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-lg border-border/60 p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parsePhDateInputToPhDate(form.dateRequired) ?? undefined}
                      onSelect={(date) =>
                        setForm((previous) => ({
                          ...previous,
                          dateRequired: toPhDateInputValue(date),
                        }))
                      }
                      disabled={(date) => {
                        const prepared = parsePhDateInputToPhDate(form.datePrepared)
                        if (!prepared) {
                          return false
                        }

                        return date < prepared
                      }}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Charge To <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.chargeToDepartmentId || "__UNSET__"}
                  onValueChange={(value) => {
                    const nextDepartmentId = value === "__UNSET__" ? "" : value
                    const nextSelectedStepApproverUserIds = getDefaultStepApproverUserIdsForDepartment(
                      departmentFlowPreviews,
                      nextDepartmentId
                    )

                    setForm((previous) => ({
                      ...previous,
                      chargeToDepartmentId: nextDepartmentId,
                      selectedStepApproverUserIds: nextSelectedStepApproverUserIds,
                    }))
                  }}
                >
                  <SelectTrigger className="w-full [&_[data-slot=select-value]]:max-w-[calc(100%-1.25rem)] [&_[data-slot=select-value]]:truncate">
                    <SelectValue className="truncate" placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border/60">
                    <SelectItem value="__UNSET__">Select department</SelectItem>
                    {departments.map((department) => {
                      const departmentLabel = `${department.name}${!department.isActive ? " (Inactive)" : ""}`
                      return (
                        <SelectItem
                          key={department.id}
                          value={department.id}
                          disabled={!department.isActive && department.id !== form.chargeToDepartmentId}
                          title={departmentLabel}
                        >
                          {truncateWithDots(departmentLabel, 27)}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {visibleApproverStepNumbers.map((stepNumber) => {
                const stepIndex = stepNumber - 1
                const options = getApproverOptionsForStep(stepNumber)
                const isRequiredStep = stepNumber <= selectedDepartmentRequiredSteps
                const isDisabled = !form.chargeToDepartmentId || !isRequiredStep
                const stepDisplayName = getStepDisplayName(selectedDepartmentFlowPreview, stepNumber)

                return (
                  <div key={stepNumber} className="space-y-2">
                    <Label className="text-xs text-foreground">
                      {stepDisplayName} {isRequiredStep ? <span className="text-destructive">*</span> : null}
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
                      <SelectTrigger className="w-full" disabled={isDisabled}>
                        <SelectValue placeholder={`Select ${stepDisplayName}`} />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-border/60">
                        <SelectItem value="__UNSET__">No specific assignee (any {stepDisplayName})</SelectItem>
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
                <Label className="text-xs text-foreground">Building Code</Label>
                <Input
                  value={form.bldgCode}
                  onChange={(event) => setForm((previous) => ({ ...previous, bldgCode: event.target.value }))}
                  placeholder="BLDG-001"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">Deliver To</Label>
                <Input
                  value={form.deliverTo}
                  onChange={(event) => setForm((previous) => ({ ...previous, deliverTo: event.target.value }))}
                  placeholder="Department / location"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-foreground">Purpose</Label>
                <Textarea
                  value={form.purpose}
                  onChange={(event) => setForm((previous) => ({ ...previous, purpose: event.target.value }))}
                  placeholder="Request purpose"
                  className="min-h-[90px] resize-none rounded-lg text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(event) => setForm((previous) => ({ ...previous, remarks: event.target.value }))}
                  placeholder="Additional notes"
                  className="min-h-[90px] resize-none rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="overflow-hidden border-y border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <IconPackage className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Request Items</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setIsExistingItemsDialogOpen(true)}
                  >
                    <IconPlus className="mr-1 h-3.5 w-3.5" />
                    Add Existing Items
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={addItem}>
                    <IconPlus className="mr-1 h-3.5 w-3.5" />
                    Add Item
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border/60">
                <div className="overflow-x-auto">
                  <div className="grid min-w-[920px] grid-cols-[2.25rem_7.5rem_minmax(0,1.2fr)_4.75rem_5.25rem_6.5rem_minmax(0,1fr)_4rem] items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <p>#</p>
                    <p>Item Code</p>
                    <p>
                      Description <span className="text-destructive">*</span>
                    </p>
                    <p>
                      UOM <span className="text-destructive">*</span>
                    </p>
                    <p className="text-right">
                      Qty <span className="text-destructive">*</span>
                    </p>
                    <p className="text-right">Unit Price</p>
                    <p>Remarks</p>
                    <p className="text-right">Action</p>
                  </div>
                  <div className="max-h-[22rem] overflow-y-auto">
                    {form.items.map((item, index) => (
                      <div
                        key={item.id}
                        className="grid min-w-[920px] grid-cols-[2.25rem_7.5rem_minmax(0,1.2fr)_4.75rem_5.25rem_6.5rem_minmax(0,1fr)_4rem] items-center gap-2 border-b border-border/60 px-2 py-2 text-xs last:border-b-0"
                      >
                        <p className="text-muted-foreground">{index + 1}</p>
                        <Input
                          value={item.itemCode}
                          readOnly
                          placeholder="Auto-generated"
                          className="h-8 bg-muted/40 text-xs text-muted-foreground"
                        />
                        <Input
                          value={item.description}
                          onChange={(event) => updateItem(item.id, { description: event.target.value })}
                          placeholder="Item description"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={item.uom}
                          onChange={(event) => updateItem(item.id, { uom: event.target.value })}
                          placeholder="PCS"
                          className="h-8 text-xs"
                        />
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                          className="h-8 text-right text-xs tabular-nums"
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })}
                          className="h-8 text-right text-xs tabular-nums"
                        />
                        <div>
                          <Input
                            value={item.remarks}
                            onChange={(event) => updateItem(item.id, { remarks: event.target.value })}
                            placeholder="Optional line note"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => removeItem(item.id)}
                            disabled={form.items.length === 1}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs text-foreground">Freight</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.freight}
                  onChange={(event) => setForm((previous) => ({ ...previous, freight: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">Discount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(event) => setForm((previous) => ({ ...previous, discount: event.target.value }))}
                />
              </div>

              <div className="flex items-end">
                <div className="flex w-full items-center rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <Checkbox
                    id="store-use"
                    checked={form.isStoreUse}
                    onCheckedChange={(checked) =>
                      setForm((previous) => ({
                        ...previous,
                        isStoreUse: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="store-use" className="ml-2 text-xs text-foreground">
                    For store use
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="px-1 py-2">
                <p className="text-[11px] text-muted-foreground">Subtotal</p>
                <p className="text-sm font-semibold text-foreground">PHP {currency.format(previewTotals.subTotal)}</p>
              </div>
              <div className="px-1 py-2">
                <p className="text-[11px] text-muted-foreground">Freight</p>
                <p className="text-sm font-semibold text-foreground">PHP {currency.format(toInputNumber(form.freight))}</p>
              </div>
              <div className="px-1 py-2">
                <p className="text-[11px] text-muted-foreground">Discount</p>
                <p className="text-sm font-semibold text-foreground">PHP {currency.format(toInputNumber(form.discount))}</p>
              </div>
              <div className="px-1 py-2">
                <p className="text-[11px] text-primary/80">Grand Total</p>
                <p className="text-sm font-semibold text-primary">PHP {currency.format(previewTotals.grandTotal)}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <MaterialRequestExistingItemsDialog
        open={isExistingItemsDialogOpen}
        onOpenChange={setIsExistingItemsDialogOpen}
        onItemsSelected={addExistingItems}
      />
    </div>
  )
}
