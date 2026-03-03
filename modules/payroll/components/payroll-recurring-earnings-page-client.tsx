"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconBuildingBank,
  IconCalendarClock,
  IconCalendarEvent,
  IconCheck,
  IconChevronsDown,
  IconDots,
  IconFilter,
  IconInfoCircle,
  IconPlus,
  IconPlayerPause,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import {
  createEarningTypeAction,
  createRecurringEarningAction,
  updateEarningTypeAction,
  updateRecurringEarningStatusAction,
} from "@/modules/payroll/actions/recurring-earning-actions"

type RecurringEarningStatus = "ACTIVE" | "INACTIVE"

type RecurringEarningRecord = {
  id: string
  employeeId: string
  employeeName: string
  employeeNumber: string
  employeePhotoUrl: string | null
  earningTypeId: string
  earningTypeName: string
  statusCode: RecurringEarningStatus
  amount: number
  amountLabel: string
  frequency: "PER_PAYROLL" | "MONTHLY"
  effectiveFromValue: string
  effectiveToValue: string
  effectiveFrom: string
  effectiveTo: string
  taxTreatment: "DEFAULT" | "TAXABLE" | "NON_TAXABLE"
  remarks: string | null
}

type RecurringEarningsPageClientProps = {
  companyId: string
  companyName: string
  employees: Array<{ id: string; label: string }>
  earningTypes: Array<{
    id: string
    code: string
    name: string
    description: string | null
    isTaxable: boolean
    isIncludedIn13thMonth: boolean
    frequencyCode: "PER_PAYROLL" | "MONTHLY"
    isCompanyOwned: boolean
  }>
  records: RecurringEarningRecord[]
  filters: {
    query: string
    status: RecurringEarningStatus | "ALL"
  }
  pagination: {
    page: number
    pageSize: number
    totalPages: number
    totalItems: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

type RecurringEarningForm = {
  employeeId: string
  earningTypeId: string
  amount: string
  frequency: "PER_PAYROLL" | "MONTHLY"
  taxTreatment: "DEFAULT" | "TAXABLE" | "NON_TAXABLE"
  effectiveFrom: string
  effectiveTo: string
  remarks: string
}

type EarningTypeForm = {
  code: string
  name: string
  description: string
  isTaxable: boolean
  isIncludedIn13thMonth: boolean
  frequencyCode: "PER_PAYROLL" | "MONTHLY"
}

const CREATE_EARNING_TYPE_VALUE = "__create_earning_type__"
const STATUS_VALUES: Array<RecurringEarningStatus> = ["ACTIVE", "INACTIVE"]

const Required = () => <span className="ml-1 text-destructive">*</span>

const fromPhDateInputValue = (value: string): Date | undefined => {
  if (!value) return undefined
  return parsePhDateInputToPhDate(value) ?? undefined
}

const getDefaultRecurringEarningForm = (): RecurringEarningForm => ({
  employeeId: "",
  earningTypeId: "",
  amount: "",
  frequency: "PER_PAYROLL",
  taxTreatment: "DEFAULT",
  effectiveFrom: toPhDateInputValue(new Date()),
  effectiveTo: "",
  remarks: "",
})

const getDefaultEarningTypeForm = (): EarningTypeForm => ({
  code: "",
  name: "",
  description: "",
  isTaxable: true,
  isIncludedIn13thMonth: false,
  frequencyCode: "PER_PAYROLL",
})

const statusBadgeClass = (status: RecurringEarningStatus): string => {
  if (status === "ACTIVE") return "bg-green-600 text-white hover:bg-green-600"
  return "bg-slate-600 text-white hover:bg-slate-600"
}

const toTaxTreatmentLabel = (taxTreatment: RecurringEarningRecord["taxTreatment"]): string => {
  if (taxTreatment === "TAXABLE") return "Taxable"
  if (taxTreatment === "NON_TAXABLE") return "Non-taxable"
  return "Default"
}

export function PayrollRecurringEarningsPageClient({
  companyId,
  companyName,
  employees,
  earningTypes,
  records,
  filters,
  pagination,
}: RecurringEarningsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [queryInput, setQueryInput] = useState(filters.query)
  const [optimisticRecords, setOptimisticRecords] = useState(records)
  const [earningTypeOptions, setEarningTypeOptions] = useState(earningTypes)
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false)

  const [form, setForm] = useState<RecurringEarningForm>(getDefaultRecurringEarningForm())
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)

  const [earningTypeDialogOpen, setEarningTypeDialogOpen] = useState(false)
  const [earningTypeForm, setEarningTypeForm] = useState<EarningTypeForm>(getDefaultEarningTypeForm())
  const [selectedEarningTypeId, setSelectedEarningTypeId] = useState<string | null>(null)
  const [earningTypeSearch, setEarningTypeSearch] = useState("")

  useEffect(() => {
    setQueryInput(filters.query)
  }, [filters.query])

  useEffect(() => {
    setOptimisticRecords(records)
  }, [records])

  useEffect(() => {
    setEarningTypeOptions(earningTypes)
  }, [earningTypes])

  useEffect(() => {
    if (!selectedRecordId) return
    if (optimisticRecords.some((record) => record.id === selectedRecordId)) return

    setSelectedRecordId(null)
    setForm(getDefaultRecurringEarningForm())
  }, [optimisticRecords, selectedRecordId])

  useEffect(() => {
    if (!selectedEarningTypeId) return
    if (earningTypeOptions.some((entry) => entry.id === selectedEarningTypeId)) return
    setSelectedEarningTypeId(null)
    setEarningTypeForm(getDefaultEarningTypeForm())
  }, [earningTypeOptions, selectedEarningTypeId])

  useEffect(() => {
    if (earningTypeDialogOpen) return
    setEarningTypeSearch("")
    setSelectedEarningTypeId(null)
    setEarningTypeForm(getDefaultEarningTypeForm())
  }, [earningTypeDialogOpen])

  const updateRoute = useCallback(
    (updates: { q?: string; status?: RecurringEarningStatus | "ALL"; page?: number }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (typeof updates.q !== "undefined") {
        const nextQuery = updates.q.trim()
        if (nextQuery) params.set("q", nextQuery)
        else params.delete("q")
      }

      if (typeof updates.status !== "undefined") {
        if (updates.status === "ALL") params.delete("status")
        else params.set("status", updates.status)
      }

      if (typeof updates.page !== "undefined") {
        if (updates.page > 1) params.set("page", String(updates.page))
        else params.delete("page")
      }

      const next = params.toString()
      if (next === searchParams.toString()) return
      router.replace(next ? `${pathname}?${next}` : pathname)
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (queryInput.trim() === filters.query.trim()) return
      updateRoute({ q: queryInput, page: 1 })
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [filters.query, queryInput, updateRoute])

  const selectedRecord = useMemo(
    () => optimisticRecords.find((record) => record.id === selectedRecordId) ?? null,
    [optimisticRecords, selectedRecordId]
  )
  const selectedEmployeeLabel = useMemo(() => {
    const selectedEmployee = employees.find((employee) => employee.id === form.employeeId)
    if (selectedEmployee) return selectedEmployee.label

    if (selectedRecord && selectedRecord.employeeId === form.employeeId) {
      return `${selectedRecord.employeeName} (${selectedRecord.employeeNumber})`
    }
    return ""
  }, [employees, form.employeeId, selectedRecord])

  const companyOwnedEarningTypes = useMemo(
    () => earningTypeOptions.filter((entry) => entry.isCompanyOwned),
    [earningTypeOptions]
  )
  const filteredCompanyOwnedEarningTypes = useMemo(() => {
    const needle = earningTypeSearch.trim().toLowerCase()
    if (!needle) return companyOwnedEarningTypes
    return companyOwnedEarningTypes.filter((entry) => `${entry.code} ${entry.name}`.toLowerCase().includes(needle))
  }, [companyOwnedEarningTypes, earningTypeSearch])

  const handleCreateNew = () => {
    setSelectedRecordId(null)
    setForm(getDefaultRecurringEarningForm())
  }

  const handleRecordSelect = (record: RecurringEarningRecord) => {
    setSelectedRecordId(record.id)
    setForm({
      employeeId: record.employeeId,
      earningTypeId: record.earningTypeId,
      amount: record.amount.toString(),
      frequency: record.frequency,
      taxTreatment: record.taxTreatment,
      effectiveFrom: record.effectiveFromValue,
      effectiveTo: record.effectiveToValue,
      remarks: record.remarks ?? "",
    })
  }

  const handleEarningTypeSelect = (value: string) => {
    if (value === CREATE_EARNING_TYPE_VALUE) {
      setEarningTypeDialogOpen(true)
      return
    }
    setForm((prev) => ({ ...prev, earningTypeId: value }))
  }

  const handleEarningTypeRowSelect = (earningTypeId: string) => {
    const selectedType = earningTypeOptions.find((entry) => entry.id === earningTypeId)
    if (!selectedType || !selectedType.isCompanyOwned) return

    setSelectedEarningTypeId(selectedType.id)
    setEarningTypeForm({
      code: selectedType.code,
      name: selectedType.name,
      description: selectedType.description ?? "",
      isTaxable: selectedType.isTaxable,
      isIncludedIn13thMonth: selectedType.isIncludedIn13thMonth,
      frequencyCode: selectedType.frequencyCode,
    })
  }

  const handleResetEarningTypeForm = () => {
    setSelectedEarningTypeId(null)
    setEarningTypeForm(getDefaultEarningTypeForm())
  }

  const handleSaveEarningType = () => {
    const code = earningTypeForm.code.trim().toUpperCase()
    const name = earningTypeForm.name.trim()

    startTransition(async () => {
      const payload = {
        companyId,
        code,
        name,
        description: earningTypeForm.description || undefined,
        isTaxable: earningTypeForm.isTaxable,
        isIncludedIn13thMonth: earningTypeForm.isIncludedIn13thMonth,
        frequencyCode: earningTypeForm.frequencyCode,
      }

      const result = selectedEarningTypeId
        ? await updateEarningTypeAction({ ...payload, earningTypeId: selectedEarningTypeId })
        : await createEarningTypeAction(payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setEarningTypeOptions((prev) => {
        const baseRecord = {
          id: result.earningTypeId,
          code,
          name,
          description: earningTypeForm.description || null,
          isTaxable: earningTypeForm.isTaxable,
          isIncludedIn13thMonth: earningTypeForm.isIncludedIn13thMonth,
          frequencyCode: earningTypeForm.frequencyCode,
          isCompanyOwned: true,
        } as const

        if (!prev.some((entry) => entry.id === result.earningTypeId)) {
          return [...prev, baseRecord].sort((a, b) => a.code.localeCompare(b.code))
        }

        return prev
          .map((entry) => (entry.id === result.earningTypeId ? { ...entry, ...baseRecord } : entry))
          .sort((a, b) => a.code.localeCompare(b.code))
      })

      setSelectedEarningTypeId(result.earningTypeId)
      setForm((prev) => ({ ...prev, earningTypeId: result.earningTypeId }))
      router.refresh()
    })
  }

  const handleSaveRecurringEarning = () => {
    const amountNumber = Number(form.amount)

    startTransition(async () => {
      const result = await createRecurringEarningAction({
        recurringEarningId: selectedRecordId ?? undefined,
        companyId,
        employeeId: form.employeeId,
        earningTypeId: form.earningTypeId,
        amount: Number.isFinite(amountNumber) ? amountNumber : 0,
        frequency: form.frequency,
        taxTreatment: form.taxTreatment,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
        remarks: form.remarks || undefined,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      handleCreateNew()
      router.refresh()
    })
  }

  const handleStatusChange = (recurringEarningId: string, statusCode: RecurringEarningStatus) => {
    const previousRecords = optimisticRecords

    setOptimisticRecords((prev) =>
      prev.map((record) => (record.id === recurringEarningId ? { ...record, statusCode } : record))
    )

    startTransition(async () => {
      const result = await updateRecurringEarningStatusAction({ companyId, recurringEarningId, statusCode })
      if (!result.ok) {
        setOptimisticRecords(previousRecords)
        toast.error(result.error)
        return
      }

      toast.success(result.message)
    })
  }

  const summary = useMemo(() => {
    const active = optimisticRecords.filter((record) => record.statusCode === "ACTIVE").length
    const inactive = optimisticRecords.filter((record) => record.statusCode === "INACTIVE").length
    return { active, inactive }
  }, [optimisticRecords])

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Payroll Operations</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <IconCalendarClock className="size-6 text-primary" />
              Recurring Earnings
            </h1>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconBuildingBank className="mr-1 size-3.5" />
              {companyName}
            </Badge>
            <Badge variant="secondary" className="h-6 px-2 text-[11px]">
              {pagination.totalItems} Records
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Manage recurring fixed earnings and allowances for payroll calculation.</p>
        </div>
      </header>

      <section className="grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">Recurring Earning Records</h2>
                <p className="text-sm text-muted-foreground">Employee recurring earnings with active status controls.</p>
              </div>
              <Button type="button" className="h-8 gap-1.5 text-xs font-medium" onClick={handleCreateNew}>
                <IconPlus className="size-3.5" />
                Add New
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px border-b border-border/60 bg-border/60">
            <div className="bg-background px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Active</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{summary.active}</p>
            </div>
            <div className="bg-background px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Inactive</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{summary.inactive}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
            <div className="relative w-full sm:w-96">
              <IconSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Search employee or earning"
                className="h-9 pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-9 gap-1.5 text-xs font-medium">
                  <IconFilter className="h-3.5 w-3.5" />
                  {filters.status === "ALL" ? "All statuses" : filters.status}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuCheckboxItem checked={filters.status === "ALL"} onCheckedChange={() => updateRoute({ status: "ALL", page: 1 })}>
                  All statuses
                </DropdownMenuCheckboxItem>
                {STATUS_VALUES.map((status) => (
                  <DropdownMenuCheckboxItem key={status} checked={filters.status === status} onCheckedChange={() => updateRoute({ status, page: 1 })}>
                    {status}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-muted/20">
                <tr className="border-b border-border/60">
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Employee</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Earning</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Frequency</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Effective</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tax</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {optimisticRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      No recurring earnings found.
                    </td>
                  </tr>
                ) : (
                  optimisticRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={cn(
                        "cursor-pointer border-b border-border/50 hover:bg-muted/20",
                        selectedRecordId === record.id ? "bg-primary/10 hover:bg-primary/10" : ""
                      )}
                      onClick={() => handleRecordSelect(record)}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 rounded-md border border-border/60 after:rounded-md">
                            <AvatarImage src={record.employeePhotoUrl ?? undefined} alt={record.employeeName} className="rounded-md object-cover" />
                            <AvatarFallback className="rounded-md text-[10px]">{getEmployeeInitials(record.employeeName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{record.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{record.employeeNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-sm text-foreground">{record.earningTypeName}</td>
                      <td className="px-3 py-2.5 align-top text-sm font-medium text-foreground">{record.amountLabel}</td>
                      <td className="px-3 py-2.5 align-top text-sm text-foreground">{record.frequency}</td>
                      <td className="px-3 py-2.5 align-top">
                        <p className="text-sm text-foreground">{record.effectiveFrom}</p>
                        <p className="text-xs text-muted-foreground">to {record.effectiveTo}</p>
                      </td>
                      <td className="px-3 py-2.5 align-top text-sm text-foreground">{toTaxTreatmentLabel(record.taxTreatment)}</td>
                      <td className="px-3 py-2.5 align-top">
                        <Badge className={cn("h-6 px-2 text-[10px] font-medium uppercase tracking-wide", statusBadgeClass(record.statusCode))}>
                          {record.statusCode}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex justify-start" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" size="icon-sm" variant="ghost" disabled={isPending}>
                                <IconDots className="size-4 rotate-90" />
                                <span className="sr-only">Open actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                              {record.statusCode === "ACTIVE" ? (
                                <DropdownMenuItem onSelect={() => handleStatusChange(record.id, "INACTIVE")} disabled={isPending}>
                                  <IconPlayerPause className="mr-2 size-4" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onSelect={() => handleStatusChange(record.id, "ACTIVE")} disabled={isPending}>
                                  Activate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalItems > 0 ? (
            <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} - {pagination.totalItems} records
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateRoute({ page: Math.max(1, pagination.page - 1) })} disabled={!pagination.hasPrevPage}>
                  Prev
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateRoute({ page: Math.min(pagination.totalPages, pagination.page + 1) })} disabled={!pagination.hasNextPage}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="overflow-hidden border border-border/60 bg-background">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {selectedRecordId ? "Edit Recurring Earning" : "New Recurring Earning"}
              </h2>
              {selectedRecordId ? <Badge variant="secondary" className="h-6 px-2 text-[11px]">Editing</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedRecordId ? "Update selected recurring earning record." : "Save recurring earning configuration for payroll calculation."}
            </p>
          </div>
          <div className="grid max-h-[calc(100vh-300px)] gap-3 overflow-y-auto px-4 py-3">
            <div className="space-y-1.5 border border-border/60 bg-muted/10 px-3 py-3">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Employee<Required />
              </Label>
              <Popover open={employeeComboboxOpen} onOpenChange={setEmployeeComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" aria-expanded={employeeComboboxOpen} className="w-full justify-between">
                    <span className="truncate text-left">{selectedEmployeeLabel || "Select employee"}</span>
                    <IconChevronsDown className="ml-2 size-4 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employee..." />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>No employees found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((employee) => (
                          <CommandItem
                            key={employee.id}
                            value={`${employee.label} ${employee.id}`}
                            onSelect={() => {
                              setForm((prev) => ({ ...prev, employeeId: employee.id }))
                              setEmployeeComboboxOpen(false)
                            }}
                          >
                            <IconCheck className={cn("mr-2 size-4", form.employeeId === employee.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{employee.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5 border border-border/60 bg-muted/10 px-3 py-3">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Earning Type<Required />
              </Label>
              <Select value={form.earningTypeId} onValueChange={handleEarningTypeSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select earning type" />
                </SelectTrigger>
                <SelectContent>
                  {earningTypeOptions.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={CREATE_EARNING_TYPE_VALUE}>+ Create Earning Type</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Amount<Required />
                </Label>
                <Input inputMode="decimal" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Frequency<Required />
                </Label>
                <Select value={form.frequency} onValueChange={(value) => setForm((prev) => ({ ...prev, frequency: value as "PER_PAYROLL" | "MONTHLY" }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_PAYROLL">Per Payroll</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tax Treatment</Label>
              <Select
                value={form.taxTreatment}
                onValueChange={(value) => setForm((prev) => ({ ...prev, taxTreatment: value as "DEFAULT" | "TAXABLE" | "NON_TAXABLE" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tax treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEFAULT">Default from Earning Type</SelectItem>
                  <SelectItem value="TAXABLE">Taxable</SelectItem>
                  <SelectItem value="NON_TAXABLE">Non-taxable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Effective From<Required />
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>{form.effectiveFrom || "Select date"}</span>
                      <IconCalendarEvent className="size-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fromPhDateInputValue(form.effectiveFrom)} onSelect={(date) => setForm((prev) => ({ ...prev, effectiveFrom: toPhDateInputValue(date) }))} captionLayout="dropdown" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Effective To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>{form.effectiveTo || "Optional"}</span>
                      <IconCalendarEvent className="size-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fromPhDateInputValue(form.effectiveTo)} onSelect={(date) => setForm((prev) => ({ ...prev, effectiveTo: toPhDateInputValue(date) }))} captionLayout="dropdown" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Remarks</Label>
              <Textarea value={form.remarks} onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))} className="h-20 resize-none" />
            </div>

            <div className="flex items-center gap-2 border-t border-border/60 pt-3">
              <Button type="button" size="sm" onClick={handleSaveRecurringEarning} disabled={isPending}>
                {isPending ? "Saving..." : selectedRecord ? "Update" : "Save"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleCreateNew}>
                Clear
              </Button>
            </div>
          </div>
        </aside>
      </section>

      <Dialog open={earningTypeDialogOpen} onOpenChange={setEarningTypeDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-[960px]">
          <DialogHeader>
            <DialogTitle>Manage Earning Types</DialogTitle>
            <DialogDescription>Create or update reusable earning types. Select a row on the left to edit.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 overflow-hidden py-2 md:grid-cols-2">
            <section className="flex flex-col gap-3 overflow-hidden border border-border/60 bg-muted/10 p-2.5 md:min-w-0 md:h-[430px]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company Earning Types</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex text-muted-foreground hover:text-foreground">
                        <IconInfoCircle className="size-3.5" aria-hidden />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="max-w-xs text-xs leading-relaxed">
                      Click a row to edit. Shared/global earning types are not editable here.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  {filteredCompanyOwnedEarningTypes.length}
                </Badge>
              </div>
              <Input value={earningTypeSearch} onChange={(event) => setEarningTypeSearch(event.target.value)} placeholder="Search code or name" className="h-8 text-xs" />
              <div className="min-h-[300px] max-h-[340px] overflow-auto border border-border/60 bg-background md:flex-1 md:max-h-none">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 w-10 text-[11px]">Select</TableHead>
                      <TableHead className="h-8 text-[11px]">Code</TableHead>
                      <TableHead className="h-8 text-[11px]">Name</TableHead>
                      <TableHead className="h-8 text-[11px]">Taxable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanyOwnedEarningTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-16 text-center text-xs text-muted-foreground">
                          No earning types found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCompanyOwnedEarningTypes.map((type) => (
                        <TableRow key={type.id} className={cn("cursor-pointer", selectedEarningTypeId === type.id ? "bg-primary/10 hover:bg-primary/10" : "")} onClick={() => handleEarningTypeRowSelect(type.id)}>
                          <TableCell className="w-10">
                            <div className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={selectedEarningTypeId === type.id}
                                onCheckedChange={(checked) => {
                                  if (checked === true) {
                                    handleEarningTypeRowSelect(type.id)
                                    return
                                  }
                                  handleResetEarningTypeForm()
                                }}
                                aria-label={`Select ${type.code} for editing`}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{type.code}</TableCell>
                          <TableCell className="text-xs">{type.name}</TableCell>
                          <TableCell className="text-xs">{type.isTaxable ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="border border-border/60 bg-muted/10 p-2.5 md:min-w-0 md:h-[430px]">
              <div className="flex h-full flex-col gap-3 overflow-hidden">
                <div className="space-y-3 overflow-y-auto pr-1">
                  <div className="space-y-1.5">
                    <Label>
                      Code <Required />
                    </Label>
                    <Input value={earningTypeForm.code} onChange={(event) => setEarningTypeForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))} placeholder="e.g. MEAL_ALLOW" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Name <Required />
                    </Label>
                    <Input value={earningTypeForm.name} onChange={(event) => setEarningTypeForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="e.g. Meal Allowance" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea value={earningTypeForm.description} onChange={(event) => setEarningTypeForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional" className="h-20 resize-none" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Default Frequency</Label>
                      <Select value={earningTypeForm.frequencyCode} onValueChange={(value) => setEarningTypeForm((prev) => ({ ...prev, frequencyCode: value as "PER_PAYROLL" | "MONTHLY" }))}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PER_PAYROLL">Per Payroll</SelectItem>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="earning-type-taxable">Taxable</Label>
                      <div className="flex h-9 items-center justify-between border border-input bg-background px-3">
                        <span className="text-sm text-muted-foreground">Enabled</span>
                        <Checkbox id="earning-type-taxable" checked={earningTypeForm.isTaxable} onCheckedChange={(checked) => setEarningTypeForm((prev) => ({ ...prev, isTaxable: checked === true }))} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="earning-type-13th">Included in 13th Month</Label>
                    <div className="flex h-9 items-center justify-between border border-input bg-background px-3">
                      <span className="text-sm text-muted-foreground">Enabled</span>
                      <Checkbox id="earning-type-13th" checked={earningTypeForm.isIncludedIn13thMonth} onCheckedChange={(checked) => setEarningTypeForm((prev) => ({ ...prev, isIncludedIn13thMonth: checked === true }))} />
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2">
                  <Button type="button" variant="secondary" onClick={handleResetEarningTypeForm} disabled={isPending}>
                    New Type
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEarningTypeDialogOpen(false)} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleSaveEarningType} disabled={isPending}>
                    {isPending ? "Saving..." : selectedEarningTypeId ? "Update Earning Type" : "Create Earning Type"}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function getEmployeeInitials(fullName: string): string {
  const [lastNamePart = "", firstNamePart = ""] = fullName.split(",")
  const first = firstNamePart.trim().charAt(0)
  const last = lastNamePart.trim().charAt(0)
  return `${first}${last}`.toUpperCase() || "NA"
}
