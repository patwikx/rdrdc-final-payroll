"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconBriefcase,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTag,
  IconUserCog,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { upsertEmploymentEntityAction } from "@/modules/settings/employment/actions/upsert-employment-entity-action"
import type { EmploymentSettingsViewModel } from "@/modules/settings/employment/utils/get-employment-settings-view-model"

type EmploymentSettingsPageProps = {
  data: EmploymentSettingsViewModel
}

type PositionForm = {
  id?: string
  code: string
  name: string
  description?: string
  level: number
  jobFamily?: string
  jobGrade?: string
  salaryGradeMin?: number
  salaryGradeMax?: number
  minExperienceYears?: number
  educationRequired?: string
  displayOrder: number
  isActive: boolean
}

type EmploymentStatusForm = {
  id?: string
  code: string
  name: string
  description?: string
  allowsPayroll: boolean
  allowsLeave: boolean
  allowsLoans: boolean
  triggersOffboarding: boolean
  displayOrder: number
  isActive: boolean
}

type EmploymentTypeForm = {
  id?: string
  code: string
  name: string
  description?: string
  hasBenefits: boolean
  hasLeaveCredits: boolean
  has13thMonth: boolean
  hasMandatoryDeductions: boolean
  maxContractMonths?: number
  displayOrder: number
  isActive: boolean
}

type EmploymentClassForm = {
  id?: string
  code: string
  name: string
  description?: string
  standardHoursPerDay: number
  standardDaysPerWeek: number
  isOvertimeEligible: boolean
  isHolidayPayEligible: boolean
  displayOrder: number
  isActive: boolean
}

type StatusFilter = "all" | "active" | "inactive"
const TABLE_PAGE_SIZE = 5

const Required = () => <span className="ml-1 text-destructive">*</span>

const createPositionForm = (): PositionForm => ({
  code: "",
  name: "",
  description: "",
  level: 1,
  jobFamily: "",
  jobGrade: "",
  salaryGradeMin: undefined,
  salaryGradeMax: undefined,
  minExperienceYears: undefined,
  educationRequired: "",
  displayOrder: 1,
  isActive: true,
})

const createEmploymentStatusForm = (): EmploymentStatusForm => ({
  code: "",
  name: "",
  description: "",
  allowsPayroll: true,
  allowsLeave: true,
  allowsLoans: true,
  triggersOffboarding: false,
  displayOrder: 1,
  isActive: true,
})

const createEmploymentTypeForm = (): EmploymentTypeForm => ({
  code: "",
  name: "",
  description: "",
  hasBenefits: true,
  hasLeaveCredits: true,
  has13thMonth: true,
  hasMandatoryDeductions: true,
  maxContractMonths: undefined,
  displayOrder: 1,
  isActive: true,
})

const createEmploymentClassForm = (): EmploymentClassForm => ({
  code: "",
  name: "",
  description: "",
  standardHoursPerDay: 8,
  standardDaysPerWeek: 5,
  isOvertimeEligible: true,
  isHolidayPayEligible: true,
  displayOrder: 1,
  isActive: true,
})

const matchesSearch = (values: Array<string | number | null | undefined>, term: string): boolean => {
  if (!term.trim()) {
    return true
  }

  const normalized = term.trim().toLowerCase()
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalized))
}

const matchesStatus = (isActive: boolean, filter: StatusFilter): boolean => {
  if (filter === "all") {
    return true
  }

  return filter === "active" ? isActive : !isActive
}

const renderActiveBadge = (isActive: boolean): React.ReactNode => {
  if (isActive) {
    return <Badge className="border-emerald-700 bg-emerald-600 text-white">Active</Badge>
  }

  return (
    <Badge variant="outline" className="border-border/70 text-muted-foreground">
      Inactive
    </Badge>
  )
}

export function EmploymentSettingsPage({ data }: EmploymentSettingsPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const roleLabel = useMemo(() => data.companyRole.split("_").join(" "), [data.companyRole])

  const [positionDialogOpen, setPositionDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [typeDialogOpen, setTypeDialogOpen] = useState(false)
  const [classDialogOpen, setClassDialogOpen] = useState(false)

  const [positionForm, setPositionForm] = useState<PositionForm>(createPositionForm())
  const [statusForm, setStatusForm] = useState<EmploymentStatusForm>(createEmploymentStatusForm())
  const [typeForm, setTypeForm] = useState<EmploymentTypeForm>(createEmploymentTypeForm())
  const [classForm, setClassForm] = useState<EmploymentClassForm>(createEmploymentClassForm())

  const [positionSearch, setPositionSearch] = useState("")
  const [positionStatusFilter, setPositionStatusFilter] = useState<StatusFilter>("all")
  const [employmentStatusSearch, setEmploymentStatusSearch] = useState("")
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState<StatusFilter>("all")
  const [employmentTypeSearch, setEmploymentTypeSearch] = useState("")
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<StatusFilter>("all")
  const [employmentClassSearch, setEmploymentClassSearch] = useState("")
  const [employmentClassFilter, setEmploymentClassFilter] = useState<StatusFilter>("all")

  const filteredPositions = useMemo(
    () =>
      data.positions.filter((item) => {
        return (
          matchesStatus(item.isActive, positionStatusFilter) &&
          matchesSearch([item.code, item.name, item.level, item.jobFamily, item.jobGrade], positionSearch)
        )
      }),
    [data.positions, positionSearch, positionStatusFilter]
  )

  const filteredEmploymentStatuses = useMemo(
    () =>
      data.employmentStatuses.filter((item) => {
        return (
          matchesStatus(item.isActive, employmentStatusFilter) &&
          matchesSearch([item.code, item.name, item.description], employmentStatusSearch)
        )
      }),
    [data.employmentStatuses, employmentStatusSearch, employmentStatusFilter]
  )

  const filteredEmploymentTypes = useMemo(
    () =>
      data.employmentTypes.filter((item) => {
        return (
          matchesStatus(item.isActive, employmentTypeFilter) &&
          matchesSearch([item.code, item.name, item.description], employmentTypeSearch)
        )
      }),
    [data.employmentTypes, employmentTypeSearch, employmentTypeFilter]
  )

  const filteredEmploymentClasses = useMemo(
    () =>
      data.employmentClasses.filter((item) => {
        return (
          matchesStatus(item.isActive, employmentClassFilter) &&
          matchesSearch([item.code, item.name, item.description], employmentClassSearch)
        )
      }),
    [data.employmentClasses, employmentClassSearch, employmentClassFilter]
  )

  const resetForms = () => {
    setPositionForm(createPositionForm())
    setStatusForm(createEmploymentStatusForm())
    setTypeForm(createEmploymentTypeForm())
    setClassForm(createEmploymentClassForm())
  }

  const savePosition = () => {
    startTransition(async () => {
      const result = await upsertEmploymentEntityAction({
        companyId: data.companyId,
        entity: "positions",
        payload: {
          id: positionForm.id,
          code: positionForm.code,
          name: positionForm.name,
          description: positionForm.description,
          level: positionForm.level,
          jobFamily: positionForm.jobFamily,
          jobGrade: positionForm.jobGrade,
          salaryGradeMin: positionForm.salaryGradeMin,
          salaryGradeMax: positionForm.salaryGradeMax,
          minExperienceYears: positionForm.minExperienceYears,
          educationRequired: positionForm.educationRequired,
          displayOrder: positionForm.displayOrder,
          isActive: positionForm.isActive,
        },
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setPositionDialogOpen(false)
      setPositionForm(createPositionForm())
      router.refresh()
    })
  }

  const saveStatus = () => {
    startTransition(async () => {
      const result = await upsertEmploymentEntityAction({
        companyId: data.companyId,
        entity: "employmentStatuses",
        payload: statusForm,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setStatusDialogOpen(false)
      setStatusForm(createEmploymentStatusForm())
      router.refresh()
    })
  }

  const saveType = () => {
    startTransition(async () => {
      const result = await upsertEmploymentEntityAction({
        companyId: data.companyId,
        entity: "employmentTypes",
        payload: typeForm,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setTypeDialogOpen(false)
      setTypeForm(createEmploymentTypeForm())
      router.refresh()
    })
  }

  const saveClass = () => {
    startTransition(async () => {
      const result = await upsertEmploymentEntityAction({
        companyId: data.companyId,
        entity: "employmentClasses",
        payload: classForm,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setClassDialogOpen(false)
      setClassForm(createEmploymentClassForm())
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
              <IconBriefcase className="size-5" />
              {data.companyName} Employment Setup
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage company positions and shared employment classifications used across employee records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{data.companyCode}</Badge>
            <Badge variant="outline">Role: {roleLabel}</Badge>
            <Button type="button" variant="ghost" onClick={resetForms} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset Forms
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <EntityTableCard
          className="lg:col-span-2"
          title="Positions"
          description="Company-scoped job positions"
          icon={<IconBriefcase className="size-4" />}
          headers={["Code", "Name", "Level", "Job Family", "Status", "Action"]}
          rows={filteredPositions.map((item) => ({
            id: item.id,
            values: [item.code, item.name, String(item.level), item.jobFamily ?? "-", renderActiveBadge(item.isActive)],
          }))}
          controls={
            <TableFilters
              searchValue={positionSearch}
              onSearchChange={setPositionSearch}
              statusValue={positionStatusFilter}
              onStatusChange={setPositionStatusFilter}
              searchPlaceholder="Search positions"
            />
          }
          onEdit={(id) => {
            const record = data.positions.find((item) => item.id === id)
            if (!record) return
            setPositionForm({
              id: record.id,
              code: record.code,
              name: record.name,
              description: record.description ?? "",
              level: record.level,
              jobFamily: record.jobFamily ?? "",
              jobGrade: record.jobGrade ?? "",
              salaryGradeMin: record.salaryGradeMin ?? undefined,
              salaryGradeMax: record.salaryGradeMax ?? undefined,
              minExperienceYears: record.minExperienceYears ?? undefined,
              educationRequired: record.educationRequired ?? "",
              displayOrder: record.displayOrder,
              isActive: record.isActive,
            })
            setPositionDialogOpen(true)
          }}
          dialog={
            <PositionDialog
              open={positionDialogOpen}
              onOpenChange={setPositionDialogOpen}
              form={positionForm}
              setForm={setPositionForm}
              onSubmit={savePosition}
              isPending={isPending}
              onCreate={() => setPositionForm(createPositionForm())}
            />
          }
        />

        <EntityTableCard
          title="Employment Status"
          description="Workforce lifecycle statuses"
          icon={<IconUserCog className="size-4" />}
          headers={["Code", "Name", "Payroll", "Offboard", "Status", "Action"]}
          rows={filteredEmploymentStatuses.map((item) => ({
            id: item.id,
            values: [
              item.code,
              item.name,
              item.allowsPayroll ? "Yes" : "No",
              item.triggersOffboarding ? "Yes" : "No",
              renderActiveBadge(item.isActive),
            ],
          }))}
          controls={
            <TableFilters
              searchValue={employmentStatusSearch}
              onSearchChange={setEmploymentStatusSearch}
              statusValue={employmentStatusFilter}
              onStatusChange={setEmploymentStatusFilter}
              searchPlaceholder="Search statuses"
            />
          }
          onEdit={(id) => {
            const record = data.employmentStatuses.find((item) => item.id === id)
            if (!record) return
            setStatusForm({
              id: record.id,
              code: record.code,
              name: record.name,
              description: record.description ?? "",
              allowsPayroll: record.allowsPayroll,
              allowsLeave: record.allowsLeave,
              allowsLoans: record.allowsLoans,
              triggersOffboarding: record.triggersOffboarding,
              displayOrder: record.displayOrder,
              isActive: record.isActive,
            })
            setStatusDialogOpen(true)
          }}
          dialog={
            <EmploymentStatusDialog
              open={statusDialogOpen}
              onOpenChange={setStatusDialogOpen}
              form={statusForm}
              setForm={setStatusForm}
              onSubmit={saveStatus}
              isPending={isPending}
              onCreate={() => setStatusForm(createEmploymentStatusForm())}
            />
          }
        />

        <EntityTableCard
          title="Employment Type"
          description="Contract/engagement categories"
          icon={<IconTag className="size-4" />}
          headers={["Code", "Name", "Benefits", "13th Month", "Status", "Action"]}
          rows={filteredEmploymentTypes.map((item) => ({
            id: item.id,
            values: [
              item.code,
              item.name,
              item.hasBenefits ? "Yes" : "No",
              item.has13thMonth ? "Yes" : "No",
              renderActiveBadge(item.isActive),
            ],
          }))}
          controls={
            <TableFilters
              searchValue={employmentTypeSearch}
              onSearchChange={setEmploymentTypeSearch}
              statusValue={employmentTypeFilter}
              onStatusChange={setEmploymentTypeFilter}
              searchPlaceholder="Search types"
            />
          }
          onEdit={(id) => {
            const record = data.employmentTypes.find((item) => item.id === id)
            if (!record) return
            setTypeForm({
              id: record.id,
              code: record.code,
              name: record.name,
              description: record.description ?? "",
              hasBenefits: record.hasBenefits,
              hasLeaveCredits: record.hasLeaveCredits,
              has13thMonth: record.has13thMonth,
              hasMandatoryDeductions: record.hasMandatoryDeductions,
              maxContractMonths: record.maxContractMonths ?? undefined,
              displayOrder: record.displayOrder,
              isActive: record.isActive,
            })
            setTypeDialogOpen(true)
          }}
          dialog={
            <EmploymentTypeDialog
              open={typeDialogOpen}
              onOpenChange={setTypeDialogOpen}
              form={typeForm}
              setForm={setTypeForm}
              onSubmit={saveType}
              isPending={isPending}
              onCreate={() => setTypeForm(createEmploymentTypeForm())}
            />
          }
        />

        <EntityTableCard
          className="lg:col-span-2"
          title="Employment Class"
          description="Schedule and overtime eligibility classes"
          icon={<IconChartBar className="size-4" />}
          headers={["Code", "Name", "Hours/Day", "Days/Week", "OT Eligible", "Status", "Action"]}
          rows={filteredEmploymentClasses.map((item) => ({
            id: item.id,
            values: [
              item.code,
              item.name,
              item.standardHoursPerDay.toFixed(2),
              String(item.standardDaysPerWeek),
              item.isOvertimeEligible ? "Yes" : "No",
              renderActiveBadge(item.isActive),
            ],
          }))}
          controls={
            <TableFilters
              searchValue={employmentClassSearch}
              onSearchChange={setEmploymentClassSearch}
              statusValue={employmentClassFilter}
              onStatusChange={setEmploymentClassFilter}
              searchPlaceholder="Search classes"
            />
          }
          onEdit={(id) => {
            const record = data.employmentClasses.find((item) => item.id === id)
            if (!record) return
            setClassForm({
              id: record.id,
              code: record.code,
              name: record.name,
              description: record.description ?? "",
              standardHoursPerDay: record.standardHoursPerDay,
              standardDaysPerWeek: record.standardDaysPerWeek,
              isOvertimeEligible: record.isOvertimeEligible,
              isHolidayPayEligible: record.isHolidayPayEligible,
              displayOrder: record.displayOrder,
              isActive: record.isActive,
            })
            setClassDialogOpen(true)
          }}
          dialog={
            <EmploymentClassDialog
              open={classDialogOpen}
              onOpenChange={setClassDialogOpen}
              form={classForm}
              setForm={setClassForm}
              onSubmit={saveClass}
              isPending={isPending}
              onCreate={() => setClassForm(createEmploymentClassForm())}
            />
          }
        />
      </div>
    </main>
  )
}

function EntityTableCard({
  className,
  title,
  description,
  icon,
  headers,
  rows,
  controls,
  onEdit,
  dialog,
}: {
  className?: string
  title: string
  description: string
  icon: React.ReactNode
  headers: string[]
  rows: Array<{ id: string; values: Array<string | React.ReactNode> }>
  controls?: React.ReactNode
  onEdit: (id: string) => void
  dialog: React.ReactNode
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedRows = rows.slice((safePage - 1) * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE)

  return (
    <section className={cn("border border-border/60 bg-background", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-base font-medium text-foreground">
            {icon}
            <span>{title}</span>
          </p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {controls}
          {dialog}
        </div>
      </div>
      <div className="p-4">
        <div className="overflow-x-auto border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-4 text-center text-muted-foreground">
                    No records yet.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.id} className="border-t border-border/50">
                    {row.values.map((value, valueIndex) => (
                      <td key={valueIndex} className="px-3 py-2 text-foreground">
                        {value}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(row.id)}>
                        <IconEdit className="size-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Page {safePage} of {totalPages} • {rows.length} records
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
              >
                <IconChevronLeft className="size-3.5" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
              >
                Next
                <IconChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function TableFilters({
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
  searchPlaceholder,
}: {
  searchValue: string
  onSearchChange: (value: string) => void
  statusValue: StatusFilter
  onStatusChange: (value: StatusFilter) => void
  searchPlaceholder: string
}) {
  return (
    <>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 w-[180px] pl-7"
        />
      </div>
      <Select value={statusValue} onValueChange={(value) => onStatusChange(value as StatusFilter)}>
        <SelectTrigger className="h-8 w-[120px]">
          <IconFilter className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </>
  )
}

function PositionDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isPending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: PositionForm
  setForm: React.Dispatch<React.SetStateAction<PositionForm>>
  onSubmit: () => void
  isPending: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" onClick={onCreate}><IconPlus className="size-3.5" /> Add Position</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Position Form</DialogTitle>
          <DialogDescription>Create or update a position record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></Field>
          <Field label="Level" required><Input type="number" value={form.level} onChange={(event) => setForm((prev) => ({ ...prev, level: Number(event.target.value) }))} /></Field>
          <Field label="Display Order" required><Input type="number" value={form.displayOrder} onChange={(event) => setForm((prev) => ({ ...prev, displayOrder: Number(event.target.value) }))} /></Field>
          <Field label="Job Family"><Input value={form.jobFamily || ""} onChange={(event) => setForm((prev) => ({ ...prev, jobFamily: event.target.value }))} /></Field>
          <Field label="Job Grade"><Input value={form.jobGrade || ""} onChange={(event) => setForm((prev) => ({ ...prev, jobGrade: event.target.value }))} /></Field>
          <Field label="Salary Min"><Input type="number" value={form.salaryGradeMin ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, salaryGradeMin: event.target.value === "" ? undefined : Number(event.target.value) }))} /></Field>
          <Field label="Salary Max"><Input type="number" value={form.salaryGradeMax ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, salaryGradeMax: event.target.value === "" ? undefined : Number(event.target.value) }))} /></Field>
          <Field label="Min Experience (years)"><Input type="number" value={form.minExperienceYears ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, minExperienceYears: event.target.value === "" ? undefined : Number(event.target.value) }))} /></Field>
          <Field label="Active">
            <SwitchRow value={form.isActive} onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} label="Status" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Education Required"><Input value={form.educationRequired || ""} onChange={(event) => setForm((prev) => ({ ...prev, educationRequired: event.target.value }))} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea className="h-16" value={form.description || ""} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmploymentStatusDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isPending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: EmploymentStatusForm
  setForm: React.Dispatch<React.SetStateAction<EmploymentStatusForm>>
  onSubmit: () => void
  isPending: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" onClick={onCreate}><IconPlus className="size-3.5" /> Add Status</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Employment Status Form</DialogTitle>
          <DialogDescription>Create or update an employment status record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></Field>
          <Field label="Display Order" required><Input type="number" value={form.displayOrder} onChange={(event) => setForm((prev) => ({ ...prev, displayOrder: Number(event.target.value) }))} /></Field>
          <Field label="Active"><SwitchRow value={form.isActive} onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} label="Status" /></Field>
          <Field label="Allows Payroll"><SwitchRow value={form.allowsPayroll} onChange={(checked) => setForm((prev) => ({ ...prev, allowsPayroll: checked }))} label="Payroll" /></Field>
          <Field label="Allows Leave"><SwitchRow value={form.allowsLeave} onChange={(checked) => setForm((prev) => ({ ...prev, allowsLeave: checked }))} label="Leave" /></Field>
          <Field label="Allows Loans"><SwitchRow value={form.allowsLoans} onChange={(checked) => setForm((prev) => ({ ...prev, allowsLoans: checked }))} label="Loans" /></Field>
          <Field label="Triggers Offboarding"><SwitchRow value={form.triggersOffboarding} onChange={(checked) => setForm((prev) => ({ ...prev, triggersOffboarding: checked }))} label="Offboarding" /></Field>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea className="h-16" value={form.description || ""} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmploymentTypeDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isPending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: EmploymentTypeForm
  setForm: React.Dispatch<React.SetStateAction<EmploymentTypeForm>>
  onSubmit: () => void
  isPending: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" onClick={onCreate}><IconPlus className="size-3.5" /> Add Type</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Employment Type Form</DialogTitle>
          <DialogDescription>Create or update an employment type record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></Field>
          <Field label="Display Order" required><Input type="number" value={form.displayOrder} onChange={(event) => setForm((prev) => ({ ...prev, displayOrder: Number(event.target.value) }))} /></Field>
          <Field label="Max Contract (months)"><Input type="number" value={form.maxContractMonths ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, maxContractMonths: event.target.value === "" ? undefined : Number(event.target.value) }))} /></Field>
          <Field label="Active"><SwitchRow value={form.isActive} onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} label="Status" /></Field>
          <Field label="Has Benefits"><SwitchRow value={form.hasBenefits} onChange={(checked) => setForm((prev) => ({ ...prev, hasBenefits: checked }))} label="Benefits" /></Field>
          <Field label="Has Leave Credits"><SwitchRow value={form.hasLeaveCredits} onChange={(checked) => setForm((prev) => ({ ...prev, hasLeaveCredits: checked }))} label="Leave" /></Field>
          <Field label="Has 13th Month"><SwitchRow value={form.has13thMonth} onChange={(checked) => setForm((prev) => ({ ...prev, has13thMonth: checked }))} label="13th Month" /></Field>
          <Field label="Mandatory Deductions"><SwitchRow value={form.hasMandatoryDeductions} onChange={(checked) => setForm((prev) => ({ ...prev, hasMandatoryDeductions: checked }))} label="Mandatory" /></Field>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea className="h-16" value={form.description || ""} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmploymentClassDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isPending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: EmploymentClassForm
  setForm: React.Dispatch<React.SetStateAction<EmploymentClassForm>>
  onSubmit: () => void
  isPending: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" onClick={onCreate}><IconPlus className="size-3.5" /> Add Class</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Employment Class Form</DialogTitle>
          <DialogDescription>Create or update an employment class record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></Field>
          <Field label="Hours Per Day" required><Input type="number" value={form.standardHoursPerDay} onChange={(event) => setForm((prev) => ({ ...prev, standardHoursPerDay: Number(event.target.value) }))} /></Field>
          <Field label="Days Per Week" required><Input type="number" value={form.standardDaysPerWeek} onChange={(event) => setForm((prev) => ({ ...prev, standardDaysPerWeek: Number(event.target.value) }))} /></Field>
          <Field label="Display Order" required><Input type="number" value={form.displayOrder} onChange={(event) => setForm((prev) => ({ ...prev, displayOrder: Number(event.target.value) }))} /></Field>
          <Field label="Active"><SwitchRow value={form.isActive} onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} label="Status" /></Field>
          <Field label="OT Eligible"><SwitchRow value={form.isOvertimeEligible} onChange={(checked) => setForm((prev) => ({ ...prev, isOvertimeEligible: checked }))} label="Overtime" /></Field>
          <Field label="Holiday Pay Eligible"><SwitchRow value={form.isHolidayPayEligible} onChange={(checked) => setForm((prev) => ({ ...prev, isHolidayPayEligible: checked }))} label="Holiday Pay" /></Field>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea className="h-16" value={form.description || ""} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required ? <Required /> : null}
      </Label>
      {children}
    </div>
  )
}

function SwitchRow({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <div className="flex h-9 items-center justify-between rounded-md border border-border/70 bg-background px-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}
