"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import {
  IconAlertTriangle,
  IconChecklist,
  IconCloudUpload,
  IconDatabaseImport,
  IconFilterOff,
  IconInfoCircle,
  IconPlayerPlay,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { syncLegacyMaterialRequestsAction } from "@/modules/settings/material-requests/actions/sync-legacy-material-requests-action"
import type { SyncLegacyMaterialRequestsInput } from "@/modules/settings/material-requests/schemas/sync-legacy-material-requests-schema"

type DepartmentOption = {
  id: string
  code: string
  name: string
}

type LegacyMaterialRequestSyncPageProps = {
  companyId: string
  companyName: string
  departments: DepartmentOption[]
}

type SyncResult = Awaited<ReturnType<typeof syncLegacyMaterialRequestsAction>>
type UnmatchedEntry = Extract<SyncResult, { ok: true }>["unmatched"][number]
type ManualOverridePayload = SyncLegacyMaterialRequestsInput["manualOverrides"][number]

type ManualOverrideDraft = {
  requesterEmployeeNumber: string
  requesterName: string
  pendingApproverEmployeeNumber: string
  recommendingApproverEmployeeNumber: string
  finalApproverEmployeeNumber: string
  departmentId: string
}

type SyncWizardStep = "edit" | "preview" | "confirm"
type UnmatchedColumnKey =
  | "reason"
  | "request"
  | "legacyStatus"
  | "mappedStatus"
  | "pendingStep"
  | "legacyDepartment"
  | "legacyRecommending"
  | "legacyFinal"
  | "requesterNumber"
  | "requesterName"
  | "pendingApprover"
  | "recommendingApprover"
  | "finalApprover"
  | "departmentNewSystem"
type UnmatchedColumnVisibility = Record<UnmatchedColumnKey, boolean>

const Required = () => <span className="ml-1 text-destructive">*</span>

const normalizeInput = (value: string): string => value.trim()
const normalizeKey = (value: string | null | undefined): string => (value ? value.trim().toLowerCase() : "")

const UNMATCHED_COLUMN_OPTIONS: Array<{ key: UnmatchedColumnKey; label: string }> = [
  { key: "reason", label: "Reason" },
  { key: "request", label: "Request" },
  { key: "legacyStatus", label: "Legacy Status" },
  { key: "mappedStatus", label: "Mapped New Status" },
  { key: "pendingStep", label: "Pending Step" },
  { key: "legacyDepartment", label: "Legacy Department" },
  { key: "legacyRecommending", label: "Legacy Recommending Approval" },
  { key: "legacyFinal", label: "Legacy Final Approval" },
  { key: "requesterNumber", label: "Requester #" },
  { key: "requesterName", label: "Requester Name" },
  { key: "pendingApprover", label: "Pending Approver Emp #" },
  { key: "recommendingApprover", label: "Recommending Approver Emp #" },
  { key: "finalApprover", label: "Final Approver Emp #" },
  { key: "departmentNewSystem", label: "Department (New System)" },
]

const DEFAULT_UNMATCHED_COLUMN_VISIBILITY: UnmatchedColumnVisibility = {
  reason: true,
  request: true,
  legacyStatus: true,
  mappedStatus: true,
  pendingStep: true,
  legacyDepartment: true,
  legacyRecommending: true,
  legacyFinal: true,
  requesterNumber: true,
  requesterName: true,
  pendingApprover: true,
  recommendingApprover: true,
  finalApprover: true,
  departmentNewSystem: true,
}

const UNMATCHED_PAGE_SIZE_OPTIONS = ["10", "20", "50"] as const
const INTERACTIVE_ROW_ELEMENT_SELECTOR =
  "input,textarea,button,a,[role='button'],[role='combobox'],[role='menuitem'],[data-no-row-select='true']"

const createDraftFromUnmatchedEntry = (entry: UnmatchedEntry, inferredDepartmentId: string): ManualOverrideDraft => ({
  requesterEmployeeNumber: entry.employeeNumber ?? "",
  requesterName: entry.requesterName ?? "",
  pendingApproverEmployeeNumber: entry.pendingApproverEmployeeNumber ?? "",
  recommendingApproverEmployeeNumber: entry.recommendingApproverEmployeeNumber ?? "",
  finalApproverEmployeeNumber: entry.finalApproverEmployeeNumber ?? "",
  departmentId: inferredDepartmentId,
})

const buildManualOverridePayload = (
  entry: UnmatchedEntry,
  draft: ManualOverrideDraft,
  inferredDepartmentId: string
): ManualOverridePayload | null => {
  const requesterEmployeeNumber = normalizeInput(draft.requesterEmployeeNumber)
  const requesterName = normalizeInput(draft.requesterName)
  const pendingApproverEmployeeNumber = normalizeInput(draft.pendingApproverEmployeeNumber)
  const recommendingApproverEmployeeNumber = normalizeInput(draft.recommendingApproverEmployeeNumber)
  const finalApproverEmployeeNumber = normalizeInput(draft.finalApproverEmployeeNumber)
  const departmentId = normalizeInput(draft.departmentId)

  const sourceRequesterEmployeeNumber = normalizeInput(entry.employeeNumber ?? "")
  const sourceRequesterName = normalizeInput(entry.requesterName ?? "")
  const sourcePendingApproverEmployeeNumber = normalizeInput(entry.pendingApproverEmployeeNumber ?? "")
  const sourceRecommendingApproverEmployeeNumber = normalizeInput(entry.recommendingApproverEmployeeNumber ?? "")
  const sourceFinalApproverEmployeeNumber = normalizeInput(entry.finalApproverEmployeeNumber ?? "")
  const sourceDepartmentId = normalizeInput(inferredDepartmentId)

  const payload: ManualOverridePayload = {
    legacyRecordId: entry.legacyRecordId,
    departmentId: undefined,
    requesterEmployeeNumber: undefined,
    requesterName: undefined,
    pendingApproverEmployeeNumber: undefined,
    recommendingApproverEmployeeNumber: undefined,
    finalApproverEmployeeNumber: undefined,
    departmentCode: undefined,
    departmentName: undefined,
  }

  if (requesterEmployeeNumber && requesterEmployeeNumber !== sourceRequesterEmployeeNumber) {
    payload.requesterEmployeeNumber = requesterEmployeeNumber
  }

  if (requesterName && requesterName !== sourceRequesterName) {
    payload.requesterName = requesterName
  }

  if (pendingApproverEmployeeNumber && pendingApproverEmployeeNumber !== sourcePendingApproverEmployeeNumber) {
    payload.pendingApproverEmployeeNumber = pendingApproverEmployeeNumber
  }
  if (
    recommendingApproverEmployeeNumber &&
    recommendingApproverEmployeeNumber !== sourceRecommendingApproverEmployeeNumber
  ) {
    payload.recommendingApproverEmployeeNumber = recommendingApproverEmployeeNumber
  }
  if (finalApproverEmployeeNumber && finalApproverEmployeeNumber !== sourceFinalApproverEmployeeNumber) {
    payload.finalApproverEmployeeNumber = finalApproverEmployeeNumber
  }

  if (departmentId && departmentId !== sourceDepartmentId) {
    payload.departmentId = departmentId
  }

  const hasAnyOverride = Boolean(
    payload.requesterEmployeeNumber ||
      payload.requesterName ||
      payload.pendingApproverEmployeeNumber ||
      payload.recommendingApproverEmployeeNumber ||
      payload.finalApproverEmployeeNumber ||
      payload.departmentId
  )

  return hasAnyOverride ? payload : null
}

export function LegacyMaterialRequestSyncPage({ companyId, companyName, departments }: LegacyMaterialRequestSyncPageProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncResult | null>(null)
  const [wizardStep, setWizardStep] = useState<SyncWizardStep>("edit")
  const [rowActionRecordId, setRowActionRecordId] = useState<string | null>(null)
  const [unmatchedColumnVisibility, setUnmatchedColumnVisibility] = useState<UnmatchedColumnVisibility>(
    DEFAULT_UNMATCHED_COLUMN_VISIBILITY
  )
  const [unmatchedSearch, setUnmatchedSearch] = useState("")
  const [unmatchedReasonFilter, setUnmatchedReasonFilter] = useState("ALL")
  const [unmatchedStatusFilter, setUnmatchedStatusFilter] = useState("ALL")
  const [unmatchedLegacyDepartmentFilter, setUnmatchedLegacyDepartmentFilter] = useState("ALL")
  const [unmatchedPageSize, setUnmatchedPageSize] =
    useState<(typeof UNMATCHED_PAGE_SIZE_OPTIONS)[number]>("10")
  const [unmatchedPage, setUnmatchedPage] = useState(1)
  const [selectedLegacyRecordIds, setSelectedLegacyRecordIds] = useState<string[]>([])
  const [isBulkSavingRows, setIsBulkSavingRows] = useState(false)

  const [form, setForm] = useState<SyncLegacyMaterialRequestsInput>({
    companyId,
    baseUrl: "",
    legacyScopeId: "",
    apiToken: "",
    materialRequestEndpoint: "/api/migration/material-requests",
    timeoutMs: 30000,
    dryRun: true,
    manualOverrides: [],
  })

  const [manualOverrideDraftByRecordId, setManualOverrideDraftByRecordId] = useState<
    Record<string, ManualOverrideDraft>
  >({})

  const unmatchedRows = useMemo(() => (result?.ok ? result.unmatched : []), [result])
  const unmatchedRowById = useMemo(
    () => new Map(unmatchedRows.map((entry) => [entry.legacyRecordId, entry])),
    [unmatchedRows]
  )

  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments])

  const departmentIdByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const department of departments) {
      const key = normalizeKey(department.code)
      if (!key) continue
      map.set(key, department.id)
    }
    return map
  }, [departments])

  const departmentIdByName = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const department of departments) {
      const key = normalizeKey(department.name)
      if (!key) continue

      const existing = map.get(key)
      if (existing === undefined) {
        map.set(key, department.id)
      } else if (existing !== department.id) {
        map.set(key, null)
      }
    }
    return map
  }, [departments])

  const inferDepartmentIdFromEntry = useCallback((entry: UnmatchedEntry): string => {
    const byCode = departmentIdByCode.get(normalizeKey(entry.departmentCode))
    if (byCode) {
      return byCode
    }

    const byName = departmentIdByName.get(normalizeKey(entry.departmentName))
    return byName ?? ""
  }, [departmentIdByCode, departmentIdByName])

  const resolveDraftForEntry = useCallback((entry: UnmatchedEntry): ManualOverrideDraft => {
    const inferredDepartmentId = inferDepartmentIdFromEntry(entry)
    return (
      manualOverrideDraftByRecordId[entry.legacyRecordId] ??
      createDraftFromUnmatchedEntry(entry, inferredDepartmentId)
    )
  }, [inferDepartmentIdFromEntry, manualOverrideDraftByRecordId])

  const summaryRows = useMemo(() => {
    if (!result || !result.ok) return []

    return [
      { label: "Fetched Material Requests", value: result.summary.fetched.materialRequests },
      { label: "Fetched Line Items", value: result.summary.fetched.items },
      { label: "Processed Material Requests", value: result.summary.processed.materialRequests },
      { label: "Processed Line Items", value: result.summary.processed.items },
      { label: "Created Approval Steps", value: result.summary.processed.approvalSteps },
      { label: "Created Serve Batches", value: result.summary.processed.serveBatches },
      { label: "Created Posting Records", value: result.summary.processed.postings },
      { label: "Unmatched Rows", value: result.summary.unmatchedCount },
      { label: "Skipped Rows", value: result.summary.skippedCount },
      { label: "Errors", value: result.summary.errorCount },
    ]
  }, [result])

  const previewRows = useMemo(() => {
    if (!result?.ok) {
      return [] as Array<{ entry: UnmatchedEntry; payload: ManualOverridePayload }>
    }

    const rows: Array<{ entry: UnmatchedEntry; payload: ManualOverridePayload }> = []

    for (const entry of result.unmatched) {
      const inferredDepartmentId = inferDepartmentIdFromEntry(entry)
      const draft = resolveDraftForEntry(entry)

      const payload = buildManualOverridePayload(entry, draft, inferredDepartmentId)
      if (payload) {
        rows.push({ entry, payload })
      }
    }

    return rows
  }, [result, inferDepartmentIdFromEntry, resolveDraftForEntry])

  const manualOverrides = useMemo(() => previewRows.map((row) => row.payload), [previewRows])
  const hiddenColumnCount = useMemo(
    () => UNMATCHED_COLUMN_OPTIONS.filter((column) => !unmatchedColumnVisibility[column.key]).length,
    [unmatchedColumnVisibility]
  )
  const unmatchedReasonOptions = useMemo(
    () => [...new Set(unmatchedRows.map((entry) => entry.reason).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [unmatchedRows]
  )
  const unmatchedMappedStatusOptions = useMemo(
    () => [...new Set(unmatchedRows.map((entry) => entry.mappedStatus).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [unmatchedRows]
  )
  const unmatchedLegacyDepartmentOptions = useMemo(
    () => [...new Set(unmatchedRows.map((entry) => entry.legacyDepartmentName || "-"))].sort((a, b) => a.localeCompare(b)),
    [unmatchedRows]
  )
  const unmatchedFilteredRows = useMemo(() => {
    const searchKey = unmatchedSearch.trim().toLowerCase()

    return unmatchedRows.filter((entry) => {
      if (unmatchedReasonFilter !== "ALL" && entry.reason !== unmatchedReasonFilter) {
        return false
      }

      if (unmatchedStatusFilter !== "ALL" && entry.mappedStatus !== unmatchedStatusFilter) {
        return false
      }

      if (
        unmatchedLegacyDepartmentFilter !== "ALL" &&
        (entry.legacyDepartmentName || "-") !== unmatchedLegacyDepartmentFilter
      ) {
        return false
      }

      if (!searchKey) {
        return true
      }

      const values = [
        entry.reason,
        entry.requestNumber,
        entry.legacyRecordId,
        entry.legacyStatus,
        entry.mappedStatus,
        entry.pendingStepName ?? "",
        entry.legacyDepartmentName,
        entry.requesterName,
        entry.employeeNumber,
        entry.pendingApproverEmployeeNumber,
        entry.recommendingApproverEmployeeNumber,
        entry.finalApproverEmployeeNumber,
      ]

      return values.some((value) => value.toLowerCase().includes(searchKey))
    })
  }, [unmatchedLegacyDepartmentFilter, unmatchedReasonFilter, unmatchedRows, unmatchedSearch, unmatchedStatusFilter])
  const unmatchedPageSizeValue = Number(unmatchedPageSize)
  const unmatchedTotalPages = Math.max(1, Math.ceil(unmatchedFilteredRows.length / unmatchedPageSizeValue))
  const unmatchedActivePage = Math.min(unmatchedPage, unmatchedTotalPages)
  const unmatchedPageRows = useMemo(() => {
    const start = (unmatchedActivePage - 1) * unmatchedPageSizeValue
    return unmatchedFilteredRows.slice(start, start + unmatchedPageSizeValue)
  }, [unmatchedActivePage, unmatchedFilteredRows, unmatchedPageSizeValue])
  const hasUnmatchedFilters =
    unmatchedSearch.trim().length > 0 ||
    unmatchedReasonFilter !== "ALL" ||
    unmatchedStatusFilter !== "ALL" ||
    unmatchedLegacyDepartmentFilter !== "ALL"
  const selectedLegacyRecordIdSet = useMemo(() => new Set(selectedLegacyRecordIds), [selectedLegacyRecordIds])
  const unmatchedPageRecordIds = useMemo(() => unmatchedPageRows.map((entry) => entry.legacyRecordId), [unmatchedPageRows])
  const isAllCurrentPageSelected =
    unmatchedPageRecordIds.length > 0 &&
    unmatchedPageRecordIds.every((legacyRecordId) => selectedLegacyRecordIdSet.has(legacyRecordId))
  const isSomeCurrentPageSelected =
    unmatchedPageRecordIds.some((legacyRecordId) => selectedLegacyRecordIdSet.has(legacyRecordId)) &&
    !isAllCurrentPageSelected
  const departmentChangedRecordIds = useMemo(() => {
    const changed: string[] = []

    for (const entry of unmatchedFilteredRows) {
      const inferredDepartmentId = normalizeInput(inferDepartmentIdFromEntry(entry))
      const draftDepartmentId = normalizeInput(resolveDraftForEntry(entry).departmentId)

      if (draftDepartmentId && draftDepartmentId !== inferredDepartmentId) {
        changed.push(entry.legacyRecordId)
      }
    }

    return changed
  }, [inferDepartmentIdFromEntry, resolveDraftForEntry, unmatchedFilteredRows])

  const applySyncResult = useCallback((response: Extract<SyncResult, { ok: true }>) => {
    setResult(response)
    setManualOverrideDraftByRecordId((previous) => {
      const next: Record<string, ManualOverrideDraft> = {}
      for (const entry of response.unmatched) {
        const inferredDepartmentId = inferDepartmentIdFromEntry(entry)
        next[entry.legacyRecordId] =
          previous[entry.legacyRecordId] ?? createDraftFromUnmatchedEntry(entry, inferredDepartmentId)
      }
      return next
    })
    setSelectedLegacyRecordIds((previous) => {
      if (previous.length === 0) {
        return previous
      }
      const remainingIds = new Set(response.unmatched.map((entry) => entry.legacyRecordId))
      return previous.filter((legacyRecordId) => remainingIds.has(legacyRecordId))
    })
  }, [inferDepartmentIdFromEntry])

  const runSync = (params: { dryRun: boolean }) => {
    startTransition(async () => {
      let response: SyncResult
      try {
        response = await syncLegacyMaterialRequestsAction({
          ...form,
          companyId,
          dryRun: params.dryRun,
          manualOverrides,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected server error."
        toast.error(`Sync request failed: ${message}`)
        return
      }

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      applySyncResult(response)
      setUnmatchedPage(1)
      toast.success(response.message)
      setWizardStep("edit")
    })
  }

  const toggleRowSelection = (legacyRecordId: string, checked: boolean) => {
    setSelectedLegacyRecordIds((previous) => {
      if (checked) {
        if (previous.includes(legacyRecordId)) {
          return previous
        }
        return [...previous, legacyRecordId]
      }

      return previous.filter((value) => value !== legacyRecordId)
    })
  }

  const toggleCurrentPageSelection = (checked: boolean) => {
    setSelectedLegacyRecordIds((previous) => {
      if (checked) {
        const next = new Set(previous)
        for (const legacyRecordId of unmatchedPageRecordIds) {
          next.add(legacyRecordId)
        }
        return [...next]
      }

      const currentPageSet = new Set(unmatchedPageRecordIds)
      return previous.filter((legacyRecordId) => !currentPageSet.has(legacyRecordId))
    })
  }

  const applyDepartmentToRows = useCallback((legacyRecordIds: string[], departmentId: string) => {
    setManualOverrideDraftByRecordId((previous) => {
      const next = { ...previous }

      for (const legacyRecordId of legacyRecordIds) {
        const row = unmatchedRowById.get(legacyRecordId)
        if (!row) {
          continue
        }

        const inferredDepartmentId = inferDepartmentIdFromEntry(row)
        const existing = next[legacyRecordId] ?? createDraftFromUnmatchedEntry(row, inferredDepartmentId)

        next[legacyRecordId] = {
          ...existing,
          departmentId,
        }
      }

      return next
    })
  }, [inferDepartmentIdFromEntry, unmatchedRowById])

  const isInteractiveRowClickTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return Boolean(target.closest(INTERACTIVE_ROW_ELEMENT_SELECTOR))
  }

  const toggleSelectionByRowClick = (legacyRecordId: string) => {
    setSelectedLegacyRecordIds((previous) => {
      if (previous.includes(legacyRecordId)) {
        return previous.filter((value) => value !== legacyRecordId)
      }

      return [...previous, legacyRecordId]
    })
  }

  const selectDepartmentChangedRows = () => {
    if (departmentChangedRecordIds.length === 0) {
      toast.error("No department-changed rows found in current filters.")
      return
    }
    setSelectedLegacyRecordIds((previous) => [...new Set([...previous, ...departmentChangedRecordIds])])
  }

  const saveSelectedRows = () => {
    startTransition(async () => {
      if (selectedLegacyRecordIds.length === 0) {
        toast.error("Select at least one row first.")
        return
      }

      setIsBulkSavingRows(true)
      try {
        const selectedRows = unmatchedRows.filter((entry) => selectedLegacyRecordIdSet.has(entry.legacyRecordId))
        if (selectedRows.length === 0) {
          toast.error("Selected rows are no longer available. Please refresh dry sync.")
          return
        }

        const selectedOverrides: ManualOverridePayload[] = []
        for (const entry of selectedRows) {
          const inferredDepartmentId = inferDepartmentIdFromEntry(entry)
          const draft = resolveDraftForEntry(entry)
          const payload = buildManualOverridePayload(entry, draft, inferredDepartmentId)
          if (payload) {
            selectedOverrides.push(payload)
          }
        }

        let applyResponse: SyncResult
        try {
          applyResponse = await syncLegacyMaterialRequestsAction({
            ...form,
            companyId,
            dryRun: false,
            targetLegacyRecordIds: selectedRows.map((entry) => entry.legacyRecordId),
            manualOverrides: selectedOverrides,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected server error."
          toast.error(`Save selected failed: ${message}`)
          return
        }

        if (!applyResponse.ok) {
          toast.error(applyResponse.error)
          return
        }

        toast.success(`Saved ${applyResponse.summary.processed.materialRequests} selected row(s). Refreshing unmatched rows...`)

        let refreshResponse: SyncResult
        try {
          refreshResponse = await syncLegacyMaterialRequestsAction({
            ...form,
            companyId,
            dryRun: true,
            manualOverrides,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected server error."
          toast.error(`Refresh failed: ${message}`)
          return
        }

        if (!refreshResponse.ok) {
          setResult(refreshResponse)
          toast.error(refreshResponse.error)
          return
        }

        applySyncResult(refreshResponse)
        setWizardStep("edit")
      } finally {
        setIsBulkSavingRows(false)
      }
    })
  }

  const saveSingleRow = (entry: UnmatchedEntry) => {
    startTransition(async () => {
      setRowActionRecordId(entry.legacyRecordId)

      try {
        const inferredDepartmentId = inferDepartmentIdFromEntry(entry)
        const draft =
          manualOverrideDraftByRecordId[entry.legacyRecordId] ??
          createDraftFromUnmatchedEntry(entry, inferredDepartmentId)
        const payload = buildManualOverridePayload(entry, draft, inferredDepartmentId)

        let applyResponse: SyncResult
        try {
          applyResponse = await syncLegacyMaterialRequestsAction({
            ...form,
            companyId,
            dryRun: false,
            targetLegacyRecordIds: [entry.legacyRecordId],
            manualOverrides: payload ? [payload] : [],
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected server error."
          toast.error(`Save row failed: ${message}`)
          return
        }

        if (!applyResponse.ok) {
          toast.error(applyResponse.error)
          return
        }

        if (applyResponse.summary.processed.materialRequests > 0) {
          toast.success(`Saved ${entry.requestNumber}. Refreshing unmatched rows...`)
        } else {
          toast.error("Row was not imported. Check row reason, then try again.")
        }

        let refreshResponse: SyncResult
        try {
          refreshResponse = await syncLegacyMaterialRequestsAction({
            ...form,
            companyId,
            dryRun: true,
            manualOverrides,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unexpected server error."
          toast.error(`Refresh failed: ${message}`)
          return
        }

        if (!refreshResponse.ok) {
          setResult(refreshResponse)
          toast.error(refreshResponse.error)
          return
        }

        applySyncResult(refreshResponse)
        setWizardStep("edit")
      } finally {
        setRowActionRecordId(null)
      }
    })
  }

  const updateDraft = (legacyRecordId: string, patch: Partial<ManualOverrideDraft>) => {
    setManualOverrideDraftByRecordId((previous) => {
      const row = unmatchedRows.find((entry) => entry.legacyRecordId === legacyRecordId)
      const existing =
        previous[legacyRecordId] ??
        (row
          ? createDraftFromUnmatchedEntry(row, inferDepartmentIdFromEntry(row))
          : {
              requesterEmployeeNumber: "",
              requesterName: "",
              pendingApproverEmployeeNumber: "",
              recommendingApproverEmployeeNumber: "",
              finalApproverEmployeeNumber: "",
              departmentId: "",
            })

      return {
        ...previous,
        [legacyRecordId]: {
          ...existing,
          ...patch,
        },
      }
    })
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <IconDatabaseImport className="size-5" />
          Legacy Material Request Sync
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import legacy material requests into {companyName}, including pending approvals and processing state.
        </p>
      </header>

      <section className="space-y-6 px-4 py-6 sm:px-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Legacy API Connection</CardTitle>
            <CardDescription>
              Step 1: run dry sync, update unmatched rows, preview changes, then confirm apply.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="baseUrl">
                  Legacy Base URL<Required />
                </Label>
                <Input
                  id="baseUrl"
                  placeholder="https://legacy.example.com"
                  value={form.baseUrl}
                  onChange={(event) => setForm((previous) => ({ ...previous, baseUrl: event.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="apiToken">API Token</Label>
                <Input
                  id="apiToken"
                  type="password"
                  placeholder="Optional bearer token"
                  value={form.apiToken ?? ""}
                  onChange={(event) => setForm((previous) => ({ ...previous, apiToken: event.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="legacyScopeId">Legacy Business Unit ID</Label>
                <Input
                  id="legacyScopeId"
                  placeholder="Optional. If blank, current companyId is used as scope."
                  value={form.legacyScopeId ?? ""}
                  onChange={(event) => setForm((previous) => ({ ...previous, legacyScopeId: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="materialRequestEndpoint">
                  Material Request Endpoint<Required />
                </Label>
                <Input
                  id="materialRequestEndpoint"
                  value={form.materialRequestEndpoint}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      materialRequestEndpoint: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeoutMs">
                  Timeout (ms)<Required />
                </Label>
                <Input
                  id="timeoutMs"
                  type="number"
                  min={5000}
                  max={120000}
                  value={String(form.timeoutMs)}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      timeoutMs: Number(event.target.value) || 30000,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => runSync({ dryRun: true })} disabled={isPending} className="gap-2">
                {isPending ? <IconRefresh className="size-4 animate-spin" /> : <IconPlayerPlay className="size-4" />}
                {isPending ? "Running Dry Sync..." : "Run Dry Sync"}
              </Button>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  setForm({
                    companyId,
                    baseUrl: "",
                    legacyScopeId: "",
                    apiToken: "",
                    materialRequestEndpoint: "/api/migration/material-requests",
                    timeoutMs: 30000,
                    dryRun: true,
                    manualOverrides: [],
                  })
                }
              >
                Reset Defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        {result?.ok ? (
          <>
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2 text-base">
                  <IconCloudUpload className="size-4" />
                  Sync Summary
                </CardTitle>
                <CardDescription>{result.message}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {summaryRows.map((row) => (
                  <div key={row.label} className="rounded-md border border-border/60 bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="text-base font-semibold text-foreground">{row.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Step 2: Unmatched Rows Editor</CardTitle>
                <CardDescription>
                  Update row details below. Approver columns expect employee numbers and are matched against employee number in this new system. You can save one row at a time or use the bulk preview/apply flow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unmatchedRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unmatched rows found.</p>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Customize visible columns for easier row-by-row correction.
                      </p>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Columns
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {UNMATCHED_COLUMN_OPTIONS.map((column) => (
                              <DropdownMenuCheckboxItem
                                key={column.key}
                                checked={unmatchedColumnVisibility[column.key]}
                                onCheckedChange={(checked) =>
                                  setUnmatchedColumnVisibility((previous) => ({
                                    ...previous,
                                    [column.key]: Boolean(checked),
                                  }))
                                }
                              >
                                {column.label}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={hiddenColumnCount === 0}
                          onClick={() => setUnmatchedColumnVisibility(DEFAULT_UNMATCHED_COLUMN_VISIBILITY)}
                        >
                          Reset Columns
                        </Button>
                      </div>
                    </div>
                    <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-6">
                      <div className="relative md:col-span-2">
                        <IconSearch className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={unmatchedSearch}
                          onChange={(event) => {
                            setUnmatchedSearch(event.target.value)
                            setUnmatchedPage(1)
                          }}
                          placeholder="Search request, legacy ID, requester, approver..."
                          className="pl-8"
                        />
                      </div>
                      <Select
                        value={unmatchedReasonFilter}
                        onValueChange={(value) => {
                          setUnmatchedReasonFilter(value)
                          setUnmatchedPage(1)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Filter reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Reasons</SelectItem>
                          {unmatchedReasonOptions.map((reason) => (
                            <SelectItem key={reason} value={reason}>
                              {reason}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={unmatchedStatusFilter}
                        onValueChange={(value) => {
                          setUnmatchedStatusFilter(value)
                          setUnmatchedPage(1)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Mapped status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Mapped Statuses</SelectItem>
                          {unmatchedMappedStatusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={unmatchedLegacyDepartmentFilter}
                        onValueChange={(value) => {
                          setUnmatchedLegacyDepartmentFilter(value)
                          setUnmatchedPage(1)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Legacy department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Legacy Departments</SelectItem>
                          {unmatchedLegacyDepartmentOptions.map((department) => (
                            <SelectItem key={department} value={department}>
                              {department}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasUnmatchedFilters}
                        onClick={() => {
                          setUnmatchedSearch("")
                          setUnmatchedReasonFilter("ALL")
                          setUnmatchedStatusFilter("ALL")
                          setUnmatchedLegacyDepartmentFilter("ALL")
                          setUnmatchedPage(1)
                        }}
                      >
                        <IconFilterOff className="size-4" />
                      </Button>
                    </div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Selected: {selectedLegacyRecordIds.length}</Badge>
                        <Select
                          value="__KEEP__"
                          onValueChange={(value) => {
                            const nextDepartmentId = value === "__UNSET__" ? "" : value
                            applyDepartmentToRows(selectedLegacyRecordIds, nextDepartmentId)
                          }}
                          disabled={selectedLegacyRecordIds.length === 0 || isPending}
                        >
                          <SelectTrigger className="h-8 w-[220px]" data-no-row-select="true">
                            <SelectValue placeholder="Apply dept to selected" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__KEEP__">Apply dept to selected...</SelectItem>
                            <SelectItem value="__UNSET__">Use legacy-detected department</SelectItem>
                            {departments.map((department) => (
                              <SelectItem key={department.id} value={department.id}>
                                {department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={selectDepartmentChangedRows}
                          disabled={isPending || departmentChangedRecordIds.length === 0}
                        >
                          Select Dept Changed ({departmentChangedRecordIds.length})
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLegacyRecordIds([])}
                          disabled={selectedLegacyRecordIds.length === 0 || isPending}
                        >
                          Clear Selection
                        </Button>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveSelectedRows}
                        disabled={selectedLegacyRecordIds.length === 0 || isPending}
                      >
                        {isBulkSavingRows ? "Saving Selected..." : "Save Selected Rows"}
                      </Button>
                    </div>
                    {unmatchedFilteredRows.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                        No rows match current filters.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-md border border-border/60">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10">
                                  <Checkbox
                                    checked={isAllCurrentPageSelected ? true : isSomeCurrentPageSelected ? "indeterminate" : false}
                                    onCheckedChange={(checked) => toggleCurrentPageSelection(checked === true)}
                                    disabled={isPending}
                                    aria-label="Select current page rows"
                                  />
                                </TableHead>
                                {unmatchedColumnVisibility.reason ? <TableHead>Reason</TableHead> : null}
                                {unmatchedColumnVisibility.request ? <TableHead>Request</TableHead> : null}
                                {unmatchedColumnVisibility.legacyStatus ? <TableHead>Legacy Status</TableHead> : null}
                                {unmatchedColumnVisibility.mappedStatus ? <TableHead>Mapped New Status</TableHead> : null}
                                {unmatchedColumnVisibility.pendingStep ? <TableHead>Pending Step</TableHead> : null}
                                {unmatchedColumnVisibility.legacyDepartment ? <TableHead>Legacy Department</TableHead> : null}
                                {unmatchedColumnVisibility.legacyRecommending ? <TableHead>Legacy Recommending Approval</TableHead> : null}
                                {unmatchedColumnVisibility.legacyFinal ? <TableHead>Legacy Final Approval</TableHead> : null}
                                {unmatchedColumnVisibility.requesterNumber ? <TableHead>Requester #</TableHead> : null}
                                {unmatchedColumnVisibility.requesterName ? <TableHead>Requester Name</TableHead> : null}
                                {unmatchedColumnVisibility.pendingApprover ? <TableHead>Pending Approver Emp #</TableHead> : null}
                                {unmatchedColumnVisibility.recommendingApprover ? <TableHead>Recommending Approver Emp #</TableHead> : null}
                                {unmatchedColumnVisibility.finalApprover ? <TableHead>Final Approver Emp #</TableHead> : null}
                                {unmatchedColumnVisibility.departmentNewSystem ? <TableHead>Department (New System)</TableHead> : null}
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {unmatchedPageRows.map((entry) => {
                                const key = `${entry.legacyRecordId}-${entry.requestNumber}`
                                const inferredDepartmentId = inferDepartmentIdFromEntry(entry)
                                const draft =
                                  manualOverrideDraftByRecordId[entry.legacyRecordId] ??
                                  createDraftFromUnmatchedEntry(entry, inferredDepartmentId)
                                const isSavingThisRow = isPending && rowActionRecordId === entry.legacyRecordId

                                return (
                                  <TableRow
                                    key={key}
                                    className={selectedLegacyRecordIdSet.has(entry.legacyRecordId) ? "cursor-pointer bg-primary/5" : "cursor-pointer"}
                                    onClick={(event) => {
                                      if (isPending || isInteractiveRowClickTarget(event.target)) {
                                        return
                                      }
                                      toggleSelectionByRowClick(entry.legacyRecordId)
                                    }}
                                  >
                                <TableCell className="align-top">
                                  <Checkbox
                                    checked={selectedLegacyRecordIdSet.has(entry.legacyRecordId)}
                                    onCheckedChange={(checked) => toggleRowSelection(entry.legacyRecordId, checked === true)}
                                    disabled={isPending}
                                    aria-label={`Select ${entry.requestNumber}`}
                                  />
                                </TableCell>
                                {unmatchedColumnVisibility.reason ? (
                                  <TableCell className="min-w-56 align-top text-xs">
                                    <div className="font-medium text-foreground">{entry.reason}</div>
                                    <div className="mt-1 text-muted-foreground">{entry.legacyRecordId}</div>
                                  </TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.request ? (
                                  <TableCell className="min-w-40 text-xs">{entry.requestNumber}</TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.legacyStatus ? (
                                  <TableCell className="min-w-28 text-xs">{entry.legacyStatus || "-"}</TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.mappedStatus ? (
                                  <TableCell className="min-w-32 text-xs">{entry.mappedStatus || "-"}</TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.pendingStep ? (
                                  <TableCell className="min-w-32 text-xs">{entry.pendingStepName || "-"}</TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.legacyDepartment ? (
                                  <TableCell className="min-w-56 text-xs">{entry.legacyDepartmentName || "-"}</TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.legacyRecommending ? (
                                  <TableCell className="min-w-56 align-top text-xs">
                                    <div className="font-medium text-foreground">{entry.recommendingApproverEmployeeNumber || "-"}</div>
                                    <div className="text-muted-foreground">{entry.recommendingApproverName || "-"}</div>
                                    <div className="text-muted-foreground">
                                      Status: {entry.recommendingApprovalStatus || "PENDING"}
                                    </div>
                                  </TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.legacyFinal ? (
                                  <TableCell className="min-w-56 align-top text-xs">
                                    <div className="font-medium text-foreground">{entry.finalApproverEmployeeNumber || "-"}</div>
                                    <div className="text-muted-foreground">{entry.finalApproverName || "-"}</div>
                                    <div className="text-muted-foreground">Status: {entry.finalApprovalStatus || "PENDING"}</div>
                                  </TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.requesterNumber ? (
                                  <TableCell className="min-w-40">
                                    <Input
                                      value={draft.requesterEmployeeNumber}
                                      onChange={(event) =>
                                        updateDraft(entry.legacyRecordId, {
                                          requesterEmployeeNumber: event.target.value,
                                        })
                                      }
                                      placeholder="Emp #"
                                    />
                                  </TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.requesterName ? (
                                  <TableCell className="min-w-56">
                                    <Input
                                      value={draft.requesterName}
                                      onChange={(event) =>
                                        updateDraft(entry.legacyRecordId, {
                                          requesterName: event.target.value,
                                        })
                                      }
                                      placeholder="Requester name"
                                    />
                                  </TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.pendingApprover ? (
                                  <TableCell className="min-w-48">
                                    <Input
                                      value={draft.pendingApproverEmployeeNumber}
                                      onChange={(event) =>
                                        updateDraft(entry.legacyRecordId, {
                                          pendingApproverEmployeeNumber: event.target.value,
                                        })
                                      }
                                      placeholder="Approver emp #"
                                    />
                                  </TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.recommendingApprover ? (
                                  <TableCell className="min-w-48">
                                    <Input
                                      value={draft.recommendingApproverEmployeeNumber}
                                      onChange={(event) =>
                                        updateDraft(entry.legacyRecordId, {
                                          recommendingApproverEmployeeNumber: event.target.value,
                                        })
                                      }
                                      placeholder="Recommending emp #"
                                    />
                                  </TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.finalApprover ? (
                                  <TableCell className="min-w-40">
                                    <Input
                                      value={draft.finalApproverEmployeeNumber}
                                      onChange={(event) =>
                                        updateDraft(entry.legacyRecordId, {
                                          finalApproverEmployeeNumber: event.target.value,
                                        })
                                      }
                                      placeholder="Final emp #"
                                    />
                                  </TableCell>
                                ) : null}
                                {unmatchedColumnVisibility.departmentNewSystem ? (
                                  <TableCell className="min-w-72">
                                    <Select
                                      value={draft.departmentId || "__UNSET__"}
                                      onValueChange={(value) => {
                                        const nextDepartmentId = value === "__UNSET__" ? "" : value
                                        const shouldApplyToSelectedRows =
                                          selectedLegacyRecordIds.length > 1 &&
                                          selectedLegacyRecordIdSet.has(entry.legacyRecordId)

                                        if (shouldApplyToSelectedRows) {
                                          applyDepartmentToRows(selectedLegacyRecordIds, nextDepartmentId)
                                          return
                                        }

                                        updateDraft(entry.legacyRecordId, {
                                          departmentId: nextDepartmentId,
                                        })
                                      }}
                                    >
                                      <SelectTrigger className="w-full" data-no-row-select="true">
                                        <SelectValue placeholder="Select department" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__UNSET__">Use legacy-detected department</SelectItem>
                                        {departments.map((department) => (
                                          <SelectItem key={department.id} value={department.id}>
                                            {department.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                ) : null}
                                <TableCell className="min-w-40 text-right">
                                  <Button
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() => saveSingleRow(entry)}
                                  >
                                    {isSavingThisRow ? "Saving..." : "Save Row"}
                                  </Button>
                                </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            Page {unmatchedActivePage} of {unmatchedTotalPages} • {unmatchedFilteredRows.length} filtered row(s)
                          </p>
                          <div className="flex items-center gap-2">
                            <Select
                              value={unmatchedPageSize}
                              onValueChange={(value) => {
                                setUnmatchedPageSize(value as (typeof UNMATCHED_PAGE_SIZE_OPTIONS)[number])
                                setUnmatchedPage(1)
                              }}
                            >
                              <SelectTrigger className="h-8 w-[110px]">
                                <SelectValue placeholder="Rows / page" />
                              </SelectTrigger>
                              <SelectContent>
                                {UNMATCHED_PAGE_SIZE_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option} / page
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={unmatchedActivePage <= 1}
                              onClick={() => setUnmatchedPage((previous) => Math.max(1, previous - 1))}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={unmatchedActivePage >= unmatchedTotalPages}
                              onClick={() => setUnmatchedPage((previous) => Math.min(unmatchedTotalPages, previous + 1))}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Manual Overrides: {manualOverrides.length}</Badge>
                      <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={() => runSync({ dryRun: true })}
                      >
                        Re-Run Dry Sync With Edits
                      </Button>
                      <Button
                        onClick={() => setWizardStep("preview")}
                        disabled={manualOverrides.length === 0 || isPending}
                      >
                        Preview Changes
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {wizardStep === "preview" ? (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Step 3: Preview Changes</CardTitle>
                  <CardDescription>
                    Review your manual updates before opening confirmation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {previewRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No manual changes to preview.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Request</TableHead>
                            <TableHead>Legacy ID</TableHead>
                            <TableHead>Changed Fields</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRows.map((row) => (
                            <TableRow key={row.entry.legacyRecordId}>
                              <TableCell className="text-xs">{row.entry.requestNumber}</TableCell>
                              <TableCell className="text-xs">{row.entry.legacyRecordId}</TableCell>
                              <TableCell className="text-xs">
                                {[
                                  row.payload.requesterEmployeeNumber
                                    ? `Requester #: ${row.payload.requesterEmployeeNumber}`
                                    : null,
                                  row.payload.requesterName ? `Requester Name: ${row.payload.requesterName}` : null,
                                  row.payload.pendingApproverEmployeeNumber
                                    ? `Pending Approver #: ${row.payload.pendingApproverEmployeeNumber}`
                                    : null,
                                  row.payload.recommendingApproverEmployeeNumber
                                    ? `Recommending Approver #: ${row.payload.recommendingApproverEmployeeNumber}`
                                    : null,
                                  row.payload.finalApproverEmployeeNumber
                                    ? `Final Approver #: ${row.payload.finalApproverEmployeeNumber}`
                                    : null,
                                  row.payload.departmentId
                                    ? `Department: ${departmentById.get(row.payload.departmentId)?.name ?? row.payload.departmentId}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => setWizardStep("edit")}>Back To Edit</Button>
                    <Button onClick={() => setWizardStep("confirm")} disabled={previewRows.length === 0}>
                      Continue To Confirmation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {wizardStep === "confirm" ? (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Step 4: Confirmation</CardTitle>
                  <CardDescription>
                    Confirm manual updates below. This will run apply sync and save records.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Manual Updates</p>
                      <p className="text-sm font-semibold text-foreground">{previewRows.length}</p>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Current Unmatched</p>
                      <p className="text-sm font-semibold text-foreground">{unmatchedRows.length}</p>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Mode</p>
                      <p className="text-sm font-semibold text-foreground">APPLY</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => setWizardStep("preview")}>Back To Preview</Button>
                    <Button onClick={() => runSync({ dryRun: false })} disabled={isPending} className="gap-2">
                      {isPending ? <IconRefresh className="size-4 animate-spin" /> : <IconPlayerPlay className="size-4" />}
                      {isPending ? "Applying Sync..." : "Confirm & Run Apply Sync"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Skipped</CardTitle>
                  <CardDescription>First 200 skipped rows.</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.skipped.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No skipped rows.</p>
                  ) : (
                    <ScrollArea className="h-64 pr-3">
                      <ul className="space-y-2 text-xs">
                        {result.skipped.map((entry, index) => (
                          <li key={`${entry.legacyRecordId}-${index}`} className="rounded-md border border-border/60 p-2">
                            <p className="font-medium text-foreground">{entry.reason}</p>
                            <p className="mt-1 text-muted-foreground">
                              {entry.requestNumber} · {entry.status || "-"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Errors</CardTitle>
                  <CardDescription>First 200 runtime errors.</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.errors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No runtime errors.</p>
                  ) : (
                    <ScrollArea className="h-64 pr-3">
                      <ul className="space-y-2 text-xs">
                        {result.errors.map((entry, index) => (
                          <li key={`${entry.message}-${index}`} className="rounded-md border border-border/60 p-2">
                            <p className="font-medium text-destructive">{entry.message}</p>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <IconInfoCircle className="size-4" />
              Mapping Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="inline-flex items-start gap-2">
              <IconChecklist className="mt-0.5 size-4 text-foreground" />
              Pending legacy requests are imported as pending approval with the mapped current step.
            </p>
            <p className="inline-flex items-start gap-2">
              <IconChecklist className="mt-0.5 size-4 text-foreground" />
              Historical approved/posted requests include line items and processing/posting status.
            </p>
            <p className="inline-flex items-start gap-2">
              <IconAlertTriangle className="mt-0.5 size-4 text-amber-500" />
              Run dry sync first, then use preview and confirmation before apply sync.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
