"use client"

import { useState, useTransition } from "react"
import type { ComponentType, ReactNode } from "react"
import {
  IconBriefcase,
  IconBuilding,
  IconCashBanknote,
  IconEdit,
  IconPlus,
  IconRosetteDiscountCheck,
  IconTrash,
  IconUserCheck,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import {
  createPositionHistoryEntryAction,
  createPreviousEmploymentEntryAction,
  createRankHistoryEntryAction,
  createSalaryHistoryEntryAction,
  createStatusHistoryEntryAction,
  deletePositionHistoryEntryAction,
  deletePreviousEmploymentEntryAction,
  deleteRankHistoryEntryAction,
  deleteSalaryHistoryEntryAction,
  deleteStatusHistoryEntryAction,
  updatePositionHistoryEntryAction,
  updatePreviousEmploymentEntryAction,
  updateRankHistoryEntryAction,
  updateSalaryHistoryEntryAction,
  updateStatusHistoryEntryAction,
} from "@/modules/employees/profile/actions/history-crud-actions"
import type { EmployeeProfileViewModel } from "@/modules/employees/profile/utils/get-employee-profile-data"

const movementTypeOptions = ["PROMOTION", "TRANSFER", "DEMOTION", "LATERAL"] as const
const salaryAdjustmentOptions = ["INCREASE", "DECREASE", "PROMOTION", "DEMOTION", "MARKET_ADJUSTMENT", "OTHER"] as const

type EmployeeData = EmployeeProfileViewModel["employee"]
type OptionsData = EmployeeProfileViewModel["options"]

type SalaryForm = {
  historyId: string | null
  effectiveDate: string
  newSalary: string
  adjustmentTypeCode: (typeof salaryAdjustmentOptions)[number]
  reason: string
}

type PositionForm = {
  historyId: string | null
  effectiveDate: string
  newPositionId: string
  newDepartmentId: string
  newBranchId: string
  movementType: (typeof movementTypeOptions)[number]
  reason: string
}

type StatusForm = {
  historyId: string | null
  effectiveDate: string
  newStatusId: string
  reason: string
}

type RankForm = {
  historyId: string | null
  effectiveDate: string
  newRankId: string
  movementType: (typeof movementTypeOptions)[number]
  reason: string
}

type PreviousEmploymentForm = {
  historyId: string | null
  companyName: string
  position: string
  startDate: string
  endDate: string
  lastSalary: string
}

type DeleteTarget =
  | { kind: "salary"; id: string }
  | { kind: "position"; id: string }
  | { kind: "status"; id: string }
  | { kind: "rank"; id: string }
  | { kind: "previousEmployment"; id: string }

const emptySalaryForm = (): SalaryForm => ({
  historyId: null,
  effectiveDate: "",
  newSalary: "",
  adjustmentTypeCode: "OTHER",
  reason: "",
})

const emptyPositionForm = (): PositionForm => ({
  historyId: null,
  effectiveDate: "",
  newPositionId: "",
  newDepartmentId: "",
  newBranchId: "",
  movementType: "LATERAL",
  reason: "",
})

const emptyStatusForm = (): StatusForm => ({
  historyId: null,
  effectiveDate: "",
  newStatusId: "",
  reason: "",
})

const emptyRankForm = (): RankForm => ({
  historyId: null,
  effectiveDate: "",
  newRankId: "",
  movementType: "LATERAL",
  reason: "",
})

const emptyPreviousEmploymentForm = (): PreviousEmploymentForm => ({
  historyId: null,
  companyName: "",
  position: "",
  startDate: "",
  endDate: "",
  lastSalary: "",
})

const toDateLabel = (value: string): string => {
  const date = parsePhDateInputToPhDate(value)
  if (!date) return "Select date"
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date)
}

const toMovementTypeValue = (value: string): (typeof movementTypeOptions)[number] => {
  return movementTypeOptions.includes(value as (typeof movementTypeOptions)[number])
    ? (value as (typeof movementTypeOptions)[number])
    : "LATERAL"
}

function RequiredLabel({ label }: { label: string }) {
  return (
    <Label>
      {label} <span className="text-destructive">*</span>
    </Label>
  )
}

function DateField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {required ? <RequiredLabel label={label} /> : <Label>{label}</Label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            {value ? toDateLabel(value) : "Select date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? (parsePhDateInputToPhDate(value) ?? undefined) : undefined}
            onSelect={(date) => onChange(toPhDateInputValue(date))}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function SectionHeader({
  title,
  number,
  icon: Icon,
  action,
}: {
  title: string
  number: string
  icon: ComponentType<{ className?: string }>
  action?: ReactNode
}) {
  return (
    <div className="mb-6 mt-4 flex items-center justify-between gap-3 border-b border-primary/20 pb-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        <span className="text-xs font-medium text-primary/60">#{number}</span>
        <span className="h-3 w-px bg-primary/20" />
        <Icon className="size-3.5" /> {title}
      </h3>
      {action ? <div>{action}</div> : null}
    </div>
  )
}

function Empty({ message = "No records found." }: { message?: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function EmployeeHistoryTab({ companyId, employee, options }: { companyId: string; employee: EmployeeData; options: OptionsData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false)
  const [positionDialogOpen, setPositionDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [rankDialogOpen, setRankDialogOpen] = useState(false)
  const [previousEmploymentDialogOpen, setPreviousEmploymentDialogOpen] = useState(false)

  const [salaryForm, setSalaryForm] = useState<SalaryForm>(emptySalaryForm())
  const [positionForm, setPositionForm] = useState<PositionForm>(emptyPositionForm())
  const [statusForm, setStatusForm] = useState<StatusForm>(emptyStatusForm())
  const [rankForm, setRankForm] = useState<RankForm>(emptyRankForm())
  const [previousEmploymentForm, setPreviousEmploymentForm] = useState<PreviousEmploymentForm>(emptyPreviousEmploymentForm())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const refreshWithSuccess = (message: string) => {
    toast.success(message)
    router.refresh()
  }

  const submitSalary = () => {
    const amount = Number(salaryForm.newSalary)
    if (!salaryForm.effectiveDate || Number.isNaN(amount) || amount <= 0) {
      toast.error("Effective date and valid salary amount are required.")
      return
    }

    startTransition(async () => {
      const result = salaryForm.historyId
        ? await updateSalaryHistoryEntryAction({
            companyId,
            employeeId: employee.id,
            historyId: salaryForm.historyId,
            effectiveDate: salaryForm.effectiveDate,
            newSalary: amount,
            adjustmentTypeCode: salaryForm.adjustmentTypeCode,
            reason: salaryForm.reason,
          })
        : await createSalaryHistoryEntryAction({
            companyId,
            employeeId: employee.id,
            effectiveDate: salaryForm.effectiveDate,
            newSalary: amount,
            adjustmentTypeCode: salaryForm.adjustmentTypeCode,
            reason: salaryForm.reason,
          })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setSalaryDialogOpen(false)
      setSalaryForm(emptySalaryForm())
      refreshWithSuccess(result.message)
    })
  }

  const submitPosition = () => {
    if (!positionForm.effectiveDate || !positionForm.newPositionId) {
      toast.error("Effective date and new position are required.")
      return
    }

    startTransition(async () => {
      const result = positionForm.historyId
        ? await updatePositionHistoryEntryAction({
            companyId,
            employeeId: employee.id,
            historyId: positionForm.historyId,
            effectiveDate: positionForm.effectiveDate,
            newPositionId: positionForm.newPositionId,
            newDepartmentId: positionForm.newDepartmentId,
            newBranchId: positionForm.newBranchId,
            movementType: positionForm.movementType,
            reason: positionForm.reason,
          })
        : await createPositionHistoryEntryAction({
            companyId,
            employeeId: employee.id,
            effectiveDate: positionForm.effectiveDate,
            newPositionId: positionForm.newPositionId,
            newDepartmentId: positionForm.newDepartmentId,
            newBranchId: positionForm.newBranchId,
            movementType: positionForm.movementType,
            reason: positionForm.reason,
          })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setPositionDialogOpen(false)
      setPositionForm(emptyPositionForm())
      refreshWithSuccess(result.message)
    })
  }

  const submitStatus = () => {
    if (!statusForm.effectiveDate || !statusForm.newStatusId) {
      toast.error("Effective date and employment status are required.")
      return
    }

    startTransition(async () => {
      const result = statusForm.historyId
        ? await updateStatusHistoryEntryAction({
            companyId,
            employeeId: employee.id,
            historyId: statusForm.historyId,
            effectiveDate: statusForm.effectiveDate,
            newStatusId: statusForm.newStatusId,
            reason: statusForm.reason,
          })
        : await createStatusHistoryEntryAction({
            companyId,
            employeeId: employee.id,
            effectiveDate: statusForm.effectiveDate,
            newStatusId: statusForm.newStatusId,
            reason: statusForm.reason,
          })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setStatusDialogOpen(false)
      setStatusForm(emptyStatusForm())
      refreshWithSuccess(result.message)
    })
  }

  const submitRank = () => {
    if (!rankForm.effectiveDate || !rankForm.newRankId) {
      toast.error("Effective date and new rank are required.")
      return
    }

    startTransition(async () => {
      const result = rankForm.historyId
        ? await updateRankHistoryEntryAction({
            companyId,
            employeeId: employee.id,
            historyId: rankForm.historyId,
            effectiveDate: rankForm.effectiveDate,
            newRankId: rankForm.newRankId,
            movementType: rankForm.movementType,
            reason: rankForm.reason,
          })
        : await createRankHistoryEntryAction({
            companyId,
            employeeId: employee.id,
            effectiveDate: rankForm.effectiveDate,
            newRankId: rankForm.newRankId,
            movementType: rankForm.movementType,
            reason: rankForm.reason,
          })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setRankDialogOpen(false)
      setRankForm(emptyRankForm())
      refreshWithSuccess(result.message)
    })
  }

  const submitPreviousEmployment = () => {
    const lastSalary = previousEmploymentForm.lastSalary.trim().length > 0 ? Number(previousEmploymentForm.lastSalary) : undefined
    if (previousEmploymentForm.companyName.trim().length === 0) {
      toast.error("Company name is required.")
      return
    }
    if (lastSalary !== undefined && (Number.isNaN(lastSalary) || lastSalary < 0)) {
      toast.error("Salary must be a valid non-negative number.")
      return
    }

    startTransition(async () => {
      const result = previousEmploymentForm.historyId
        ? await updatePreviousEmploymentEntryAction({
            companyId,
            employeeId: employee.id,
            historyId: previousEmploymentForm.historyId,
            companyName: previousEmploymentForm.companyName,
            position: previousEmploymentForm.position,
            startDate: previousEmploymentForm.startDate,
            endDate: previousEmploymentForm.endDate,
            lastSalary,
          })
        : await createPreviousEmploymentEntryAction({
            companyId,
            employeeId: employee.id,
            companyName: previousEmploymentForm.companyName,
            position: previousEmploymentForm.position,
            startDate: previousEmploymentForm.startDate,
            endDate: previousEmploymentForm.endDate,
            lastSalary,
          })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setPreviousEmploymentDialogOpen(false)
      setPreviousEmploymentForm(emptyPreviousEmploymentForm())
      refreshWithSuccess(result.message)
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return

    startTransition(async () => {
      let result:
        | Awaited<ReturnType<typeof deleteSalaryHistoryEntryAction>>
        | Awaited<ReturnType<typeof deletePositionHistoryEntryAction>>
        | Awaited<ReturnType<typeof deleteStatusHistoryEntryAction>>
        | Awaited<ReturnType<typeof deleteRankHistoryEntryAction>>
        | Awaited<ReturnType<typeof deletePreviousEmploymentEntryAction>>

      if (deleteTarget.kind === "salary") {
        result = await deleteSalaryHistoryEntryAction({ companyId, employeeId: employee.id, historyId: deleteTarget.id })
      } else if (deleteTarget.kind === "position") {
        result = await deletePositionHistoryEntryAction({ companyId, employeeId: employee.id, historyId: deleteTarget.id })
      } else if (deleteTarget.kind === "status") {
        result = await deleteStatusHistoryEntryAction({ companyId, employeeId: employee.id, historyId: deleteTarget.id })
      } else if (deleteTarget.kind === "rank") {
        result = await deleteRankHistoryEntryAction({ companyId, employeeId: employee.id, historyId: deleteTarget.id })
      } else {
        result = await deletePreviousEmploymentEntryAction({ companyId, employeeId: employee.id, historyId: deleteTarget.id })
      }

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDeleteTarget(null)
      refreshWithSuccess(result.message)
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Salary History"
          number="01"
          icon={IconCashBanknote}
          action={
            <Button
              size="sm"
              onClick={() => {
                setSalaryForm(emptySalaryForm())
                setSalaryDialogOpen(true)
              }}
            >
              <IconPlus className="size-4" /> Add Salary History
            </Button>
          }
        />
        <HistoryTable
          headers={["Effective", "Previous", "Current", "Adjustment", "Reason", "Actions"]}
          rows={employee.salaryHistory.map((row) => [
            row.effectiveDate,
            row.previous,
            row.current,
            row.adjustment,
            row.reason,
            <RowActions
              key={row.id}
              onEdit={() => {
                setSalaryForm({
                  historyId: row.id,
                  effectiveDate: row.effectiveDateValue,
                  newSalary: row.newSalaryValue.toString(),
                  adjustmentTypeCode: (salaryAdjustmentOptions.includes(row.adjustmentTypeCode as (typeof salaryAdjustmentOptions)[number])
                    ? row.adjustmentTypeCode
                    : "OTHER") as (typeof salaryAdjustmentOptions)[number],
                  reason: row.reasonValue,
                })
                setSalaryDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget({ kind: "salary", id: row.id })}
            />,
          ])}
        />
      </div>

      <div>
        <SectionHeader
          title="Position History"
          number="02"
          icon={IconBriefcase}
          action={
            <Button
              size="sm"
              onClick={() => {
                setPositionForm(emptyPositionForm())
                setPositionDialogOpen(true)
              }}
            >
              <IconPlus className="size-4" /> Add Position History
            </Button>
          }
        />
        <HistoryTable
          headers={["Effective", "Previous", "Current", "Movement", "Reason", "Actions"]}
          rows={employee.positionHistory.map((row) => [
            row.effectiveDate,
            row.previous,
            row.current,
            row.movement,
            row.reason,
            <RowActions
              key={row.id}
              onEdit={() => {
                setPositionForm({
                  historyId: row.id,
                  effectiveDate: row.effectiveDateValue,
                  newPositionId: row.newPositionId,
                  newDepartmentId: row.newDepartmentId,
                  newBranchId: row.newBranchId,
                  movementType: toMovementTypeValue(row.movementType),
                  reason: row.reasonValue,
                })
                setPositionDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget({ kind: "position", id: row.id })}
            />,
          ])}
        />
      </div>

      <div>
        <SectionHeader
          title="Employment Status History"
          number="03"
          icon={IconUserCheck}
          action={
            <Button
              size="sm"
              onClick={() => {
                setStatusForm(emptyStatusForm())
                setStatusDialogOpen(true)
              }}
            >
              <IconPlus className="size-4" /> Add Status History
            </Button>
          }
        />
        <HistoryTable
          headers={["Effective", "Previous", "Current", "Reason", "Actions"]}
          rows={employee.statusHistory.map((row) => [
            row.effectiveDate,
            row.previous,
            row.current,
            row.reason,
            <RowActions
              key={row.id}
              onEdit={() => {
                setStatusForm({
                  historyId: row.id,
                  effectiveDate: row.effectiveDateValue,
                  newStatusId: row.newStatusId,
                  reason: row.reasonValue,
                })
                setStatusDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget({ kind: "status", id: row.id })}
            />,
          ])}
        />
      </div>

      <div>
        <SectionHeader
          title="Rank History"
          number="04"
          icon={IconRosetteDiscountCheck}
          action={
            <Button
              size="sm"
              onClick={() => {
                setRankForm(emptyRankForm())
                setRankDialogOpen(true)
              }}
            >
              <IconPlus className="size-4" /> Add Rank History
            </Button>
          }
        />
        <HistoryTable
          headers={["Effective", "Previous", "Current", "Movement", "Reason", "Actions"]}
          rows={employee.rankHistory.map((row) => [
            row.effectiveDate,
            row.previous,
            row.current,
            row.movement,
            row.reason,
            <RowActions
              key={row.id}
              onEdit={() => {
                setRankForm({
                  historyId: row.id,
                  effectiveDate: row.effectiveDateValue,
                  newRankId: row.newRankId,
                  movementType: toMovementTypeValue(row.movementType),
                  reason: row.reasonValue,
                })
                setRankDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget({ kind: "rank", id: row.id })}
            />,
          ])}
        />
      </div>

      <div>
        <SectionHeader
          title="Previous Employment"
          number="05"
          icon={IconBuilding}
          action={
            <Button
              size="sm"
              onClick={() => {
                setPreviousEmploymentForm(emptyPreviousEmploymentForm())
                setPreviousEmploymentDialogOpen(true)
              }}
            >
              <IconPlus className="size-4" /> Add Previous Employment
            </Button>
          }
        />
        <HistoryTable
          headers={["Company", "Position", "Start", "End", "Salary", "Actions"]}
          rows={employee.previousEmployments.map((row) => [
            row.company,
            row.position,
            row.startDate,
            row.endDate,
            row.salary,
            <RowActions
              key={row.id}
              onEdit={() => {
                setPreviousEmploymentForm({
                  historyId: row.id,
                  companyName: row.company,
                  position: row.positionValue,
                  startDate: row.startDateValue,
                  endDate: row.endDateValue,
                  lastSalary: row.salaryValue?.toString() ?? "",
                })
                setPreviousEmploymentDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget({ kind: "previousEmployment", id: row.id })}
            />,
          ])}
        />
      </div>

      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{salaryForm.historyId ? "Edit Salary History" : "Add Salary History"}</DialogTitle>
            <DialogDescription>Changes here also sync the employee current salary based on latest effective record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <DateField label="Effective Date" value={salaryForm.effectiveDate} onChange={(value) => setSalaryForm((prev) => ({ ...prev, effectiveDate: value }))} required />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <RequiredLabel label="New Salary" />
                <Input inputMode="decimal" value={salaryForm.newSalary} onChange={(event) => setSalaryForm((prev) => ({ ...prev, newSalary: event.target.value }))} placeholder="e.g. 35000" />
              </div>
              <div className="space-y-1.5">
                <RequiredLabel label="Adjustment Type" />
                <Select value={salaryForm.adjustmentTypeCode} onValueChange={(value) => setSalaryForm((prev) => ({ ...prev, adjustmentTypeCode: value as (typeof salaryAdjustmentOptions)[number] }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salaryAdjustmentOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea value={salaryForm.reason} onChange={(event) => setSalaryForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="Optional" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitSalary} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={positionDialogOpen} onOpenChange={setPositionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{positionForm.historyId ? "Edit Position History" : "Add Position History"}</DialogTitle>
            <DialogDescription>Latest position history controls current position/department/branch fields.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <DateField label="Effective Date" value={positionForm.effectiveDate} onChange={(value) => setPositionForm((prev) => ({ ...prev, effectiveDate: value }))} required />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <RequiredLabel label="New Position" />
                <Select value={positionForm.newPositionId} onValueChange={(value) => setPositionForm((prev) => ({ ...prev, newPositionId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>
                    {options.positions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={positionForm.newDepartmentId || "__none__"} onValueChange={(value) => setPositionForm((prev) => ({ ...prev, newDepartmentId: value === "__none__" ? "" : value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="No change" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No change</SelectItem>
                    {options.departments.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={positionForm.newBranchId || "__none__"} onValueChange={(value) => setPositionForm((prev) => ({ ...prev, newBranchId: value === "__none__" ? "" : value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="No change" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No change</SelectItem>
                    {options.branches.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <RequiredLabel label="Movement Type" />
                <Select value={positionForm.movementType} onValueChange={(value) => setPositionForm((prev) => ({ ...prev, movementType: value as (typeof movementTypeOptions)[number] }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {movementTypeOptions.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea value={positionForm.reason} onChange={(event) => setPositionForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="Optional" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPositionDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitPosition} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusForm.historyId ? "Edit Employment Status History" : "Add Employment Status History"}</DialogTitle>
            <DialogDescription>Latest status history controls current employment status.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DateField label="Effective Date" value={statusForm.effectiveDate} onChange={(value) => setStatusForm((prev) => ({ ...prev, effectiveDate: value }))} required />
              <div className="space-y-1.5">
                <RequiredLabel label="New Employment Status" />
                <Select value={statusForm.newStatusId} onValueChange={(value) => setStatusForm((prev) => ({ ...prev, newStatusId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {options.employmentStatuses.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea value={statusForm.reason} onChange={(event) => setStatusForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="Optional" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitStatus} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rankDialogOpen} onOpenChange={setRankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rankForm.historyId ? "Edit Rank History" : "Add Rank History"}</DialogTitle>
            <DialogDescription>Latest rank history controls the current employee rank.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <DateField label="Effective Date" value={rankForm.effectiveDate} onChange={(value) => setRankForm((prev) => ({ ...prev, effectiveDate: value }))} required />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <RequiredLabel label="New Rank" />
                <Select value={rankForm.newRankId} onValueChange={(value) => setRankForm((prev) => ({ ...prev, newRankId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select rank" /></SelectTrigger>
                  <SelectContent>
                    {options.ranks.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <RequiredLabel label="Movement Type" />
                <Select value={rankForm.movementType} onValueChange={(value) => setRankForm((prev) => ({ ...prev, movementType: value as (typeof movementTypeOptions)[number] }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {movementTypeOptions.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea value={rankForm.reason} onChange={(event) => setRankForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="Optional" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRankDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitRank} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previousEmploymentDialogOpen} onOpenChange={setPreviousEmploymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previousEmploymentForm.historyId ? "Edit Previous Employment" : "Add Previous Employment"}</DialogTitle>
            <DialogDescription>Maintain employee previous-employment records using dialog-based CRUD.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <RequiredLabel label="Company Name" />
              <Input value={previousEmploymentForm.companyName} onChange={(event) => setPreviousEmploymentForm((prev) => ({ ...prev, companyName: event.target.value }))} placeholder="Company name" />
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Input value={previousEmploymentForm.position} onChange={(event) => setPreviousEmploymentForm((prev) => ({ ...prev, position: event.target.value }))} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DateField label="Start Date" value={previousEmploymentForm.startDate} onChange={(value) => setPreviousEmploymentForm((prev) => ({ ...prev, startDate: value }))} />
              <DateField label="End Date" value={previousEmploymentForm.endDate} onChange={(value) => setPreviousEmploymentForm((prev) => ({ ...prev, endDate: value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Salary</Label>
              <Input inputMode="decimal" value={previousEmploymentForm.lastSalary} onChange={(event) => setPreviousEmploymentForm((prev) => ({ ...prev, lastSalary: event.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviousEmploymentDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitPreviousEmployment} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete History Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected history row. Current employee data may be re-synced from the latest remaining history record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function HistoryTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | ReactNode>> }) {
  if (rows.length === 0) return <Empty />

  return (
    <div className="overflow-x-auto border border-border/60">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`} className="border-t border-border/60">
              {row.map((cell, idx) => (
                <td key={`cell-${index}-${idx}`} className="px-3 py-2 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onEdit}>
        <IconEdit className="size-3.5" /> Edit
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
        <IconTrash className="size-3.5" /> Delete
      </Button>
    </div>
  )
}
