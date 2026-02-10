"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconCalendarClock, IconCalendarEvent, IconDots, IconFilter, IconPlayerPause, IconSearch, IconX } from "@tabler/icons-react"
import { RecurringDeductionStatus } from "@prisma/client"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  createDeductionTypeAction,
  createRecurringDeductionAction,
  updateRecurringDeductionStatusAction,
} from "@/modules/payroll/actions/recurring-deduction-actions"

type RecurringDeductionsPageClientProps = {
  companyId: string
  companyName: string
  employees: Array<{ id: string; label: string }>
  deductionTypes: Array<{ id: string; code: string; name: string }>
  records: Array<{
    id: string
    employeeId: string
    employeeName: string
    employeeNumber: string
    employeePhotoUrl: string | null
    deductionTypeId: string
    deductionTypeName: string
    statusCode: RecurringDeductionStatus
    amount: number
    amountLabel: string
    frequency: string
    effectiveFromValue: string
    effectiveToValue: string
    effectiveFrom: string
    effectiveTo: string
    percentageRate: number | null
    isPercentage: boolean
    remarks: string | null
    description: string | null
  }>
}

type RecurringDeductionForm = {
  employeeId: string
  deductionTypeId: string
  description: string
  amount: string
  isPercentage: boolean
  percentageRate: string
  frequency: "PER_PAYROLL" | "MONTHLY"
  effectiveFrom: string
  effectiveTo: string
  remarks: string
}

type DeductionTypeForm = {
  code: string
  name: string
  description: string
  isPreTax: boolean
  payPeriodApplicability: "EVERY_PAYROLL" | "FIRST_HALF" | "SECOND_HALF"
}

const CREATE_DEDUCTION_TYPE_VALUE = "__create_deduction_type__"
const Required = () => <span className="ml-1 text-destructive">*</span>

const toPhDateInputValue = (date: Date | undefined): string => {
  if (!date) return ""
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date)
}

const fromPhDateInputValue = (value: string): Date | undefined => {
  if (!value) return undefined
  return new Date(`${value}T00:00:00+08:00`)
}

const getDefaultRecurringDeductionForm = (): RecurringDeductionForm => ({
  employeeId: "",
  deductionTypeId: "",
  description: "",
  amount: "",
  isPercentage: false,
  percentageRate: "",
  frequency: "PER_PAYROLL",
  effectiveFrom: toPhDateInputValue(new Date()),
  effectiveTo: "",
  remarks: "",
})

export function PayrollRecurringDeductionsPageClient({
  companyId,
  companyName,
  employees,
  deductionTypes,
  records,
}: RecurringDeductionsPageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<RecurringDeductionStatus | null>(null)
  const [form, setForm] = useState<RecurringDeductionForm>(getDefaultRecurringDeductionForm())
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)

  const [deductionTypeDialogOpen, setDeductionTypeDialogOpen] = useState(false)
  const [deductionTypeForm, setDeductionTypeForm] = useState<DeductionTypeForm>({
    code: "",
    name: "",
    description: "",
    isPreTax: true,
    payPeriodApplicability: "EVERY_PAYROLL",
  })

  const filteredRecords = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return records
    return records.filter((record) => {
      const haystack = `${record.employeeName} ${record.employeeNumber} ${record.deductionTypeName}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [records, searchTerm])

  const visibleRecords = useMemo(() => {
    if (statusFilter === null) return filteredRecords
    return filteredRecords.filter((record) => record.statusCode === statusFilter)
  }, [filteredRecords, statusFilter])

  const statusValues = useMemo(
    () => Array.from(new Set(records.map((record) => record.statusCode))),
    [records]
  )

  const handleCreateNew = () => {
    setSelectedRecordId(null)
    setForm(getDefaultRecurringDeductionForm())
  }

  const handleRecordSelect = (record: RecurringDeductionsPageClientProps["records"][number]) => {
    setSelectedRecordId(record.id)
    setForm({
      employeeId: record.employeeId,
      deductionTypeId: record.deductionTypeId,
      description: record.description ?? "",
      amount: record.amount.toString(),
      isPercentage: record.isPercentage,
      percentageRate: record.percentageRate !== null ? record.percentageRate.toString() : "",
      frequency: record.frequency === "MONTHLY" ? "MONTHLY" : "PER_PAYROLL",
      effectiveFrom: record.effectiveFromValue,
      effectiveTo: record.effectiveToValue,
      remarks: record.remarks ?? "",
    })
  }

  const handleDeductionTypeSelect = (value: string) => {
    if (value === CREATE_DEDUCTION_TYPE_VALUE) {
      setDeductionTypeDialogOpen(true)
      return
    }
    setForm((prev) => ({ ...prev, deductionTypeId: value }))
  }

  const handleCreateDeductionType = () => {
    const code = deductionTypeForm.code.trim().toUpperCase()
    const name = deductionTypeForm.name.trim()

    startTransition(async () => {
      const result = await createDeductionTypeAction({
        companyId,
        code,
        name,
        description: deductionTypeForm.description || undefined,
        isPreTax: deductionTypeForm.isPreTax,
        payPeriodApplicability: deductionTypeForm.payPeriodApplicability,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setDeductionTypeDialogOpen(false)
      setDeductionTypeForm({
        code: "",
        name: "",
        description: "",
        isPreTax: true,
        payPeriodApplicability: "EVERY_PAYROLL",
      })
      setForm((prev) => ({ ...prev, deductionTypeId: result.deductionTypeId }))
      router.refresh()
    })
  }

  const handleCreateRecurringDeduction = () => {
    const amountNumber = Number(form.amount)
    const percentageRate = form.percentageRate ? Number(form.percentageRate) : undefined

    startTransition(async () => {
      const result = await createRecurringDeductionAction({
        recurringDeductionId: selectedRecordId ?? undefined,
        companyId,
        employeeId: form.employeeId,
        deductionTypeId: form.deductionTypeId,
        description: form.description || undefined,
        amount: Number.isFinite(amountNumber) ? amountNumber : 0,
        isPercentage: form.isPercentage,
        percentageRate,
        frequency: form.frequency,
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

  const handleStatusChange = (recurringDeductionId: string, statusCode: "ACTIVE" | "SUSPENDED" | "CANCELLED") => {
    startTransition(async () => {
      const result = await updateRecurringDeductionStatusAction({ companyId, recurringDeductionId, statusCode })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const statusBadgeClass = (status: RecurringDeductionStatus): string => {
    if (status === RecurringDeductionStatus.ACTIVE) return "bg-green-600 text-white hover:bg-green-600"
    if (status === RecurringDeductionStatus.CANCELLED) return "bg-red-600 text-white hover:bg-red-600"
    if (status === RecurringDeductionStatus.SUSPENDED) return "bg-amber-600 text-white hover:bg-amber-600"
    return ""
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"><IconCalendarClock className="size-5" /> {companyName} Recurring Deductions</h1>
        <p className="text-sm text-muted-foreground">Manage recurring deductions using active deduction type configuration records.</p>
      </header>

      <section className="grid border-b border-border/60 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="xl:border-r xl:border-border/60">
          <div className="border-b border-border/60 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-medium text-foreground">Recurring Deduction Records</h2>
                <p className="text-sm text-muted-foreground">Employee recurring deductions with active status controls.</p>
              </div>
              <Button type="button" onClick={handleCreateNew}>+ Add New</Button>
            </div>
          </div>
          <div className="space-y-3 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-96">
                <IconSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search employee or deduction" className="pl-9" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline">
                    <IconFilter className="h-4 w-4" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuCheckboxItem checked={statusFilter === null} onCheckedChange={() => setStatusFilter(null)}>
                    All statuses
                  </DropdownMenuCheckboxItem>
                  {statusValues.map((status) => (
                    <DropdownMenuCheckboxItem key={status} checked={statusFilter === status} onCheckedChange={() => setStatusFilter(status)}>
                      {status}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="overflow-x-auto border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-left">Deduction</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Frequency</th>
                    <th className="px-3 py-2 text-left">Effective</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        No recurring deductions found.
                      </td>
                    </tr>
                  ) : (
                    visibleRecords.map((record) => (
                      <tr
                        key={record.id}
                        className={cn(
                          "border-t border-border/60 hover:bg-muted/30",
                          selectedRecordId === record.id ? "bg-primary text-primary-foreground hover:bg-primary" : ""
                        )}
                        onClick={() => handleRecordSelect(record)}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 rounded-md border border-border/60 after:rounded-md">
                              <AvatarImage src={record.employeePhotoUrl ?? undefined} alt={record.employeeName} className="!rounded-md object-cover" />
                              <AvatarFallback className="!rounded-md text-[10px]">{getEmployeeInitials(record.employeeName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p>{record.employeeName}</p>
                              <p className={cn("text-[11px]", selectedRecordId === record.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{record.employeeNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{record.deductionTypeName}</td>
                        <td className="px-3 py-2">
                          <p>{record.amountLabel}</p>
                          {record.isPercentage && record.percentageRate !== null ? (
                            <p className={cn("text-[11px]", selectedRecordId === record.id ? "text-primary-foreground/80" : "text-muted-foreground")}>Rate: {record.percentageRate.toFixed(4)}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{record.frequency}</td>
                        <td className="px-3 py-2">
                          <p>{record.effectiveFrom}</p>
                          <p className={cn("text-[11px]", selectedRecordId === record.id ? "text-primary-foreground/80" : "text-muted-foreground")}>to {record.effectiveTo}</p>
                        </td>
                        <td className="px-3 py-2"><Badge className={statusBadgeClass(record.statusCode)}>{record.statusCode}</Badge></td>
                        <td className="px-3 py-2">
                          <div className="flex justify-start" onClick={(event) => event.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" size="icon-sm" variant="ghost" disabled={isPending}>
                                  <IconDots className="size-4 rotate-90" />
                                  <span className="sr-only">Open actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-44">
                                {record.statusCode === RecurringDeductionStatus.ACTIVE ? (
                                  <DropdownMenuItem onSelect={() => handleStatusChange(record.id, RecurringDeductionStatus.SUSPENDED)} disabled={isPending}>
                                    <IconPlayerPause className="mr-2 size-4" />
                                    Suspend
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => handleStatusChange(record.id, RecurringDeductionStatus.ACTIVE)} disabled={isPending}>
                                    {record.statusCode === RecurringDeductionStatus.CANCELLED ? "Reactivate" : "Activate"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => handleStatusChange(record.id, RecurringDeductionStatus.CANCELLED)} disabled={isPending || record.statusCode === RecurringDeductionStatus.CANCELLED}>
                                  <IconX className="mr-2 size-4" />
                                  Cancel
                                </DropdownMenuItem>
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
          </div>
        </section>

        <aside className="xl:sticky xl:top-20 xl:h-fit">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-base font-medium text-foreground">{selectedRecordId ? "Edit Recurring Deduction" : "New Recurring Deduction"}</h2>
            <p className="text-sm text-muted-foreground">{selectedRecordId ? "Update selected recurring deduction record." : "Save recurring deduction configuration for payroll calculation."}</p>
          </div>
          <div className="grid gap-3 px-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Employee<Required /></Label>
              <Select value={form.employeeId} onValueChange={(value) => setForm((prev) => ({ ...prev, employeeId: value }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Deduction Type<Required /></Label>
              <Select value={form.deductionTypeId} onValueChange={handleDeductionTypeSelect}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select deduction type" /></SelectTrigger>
                <SelectContent>
                  {deductionTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                  <SelectItem value={CREATE_DEDUCTION_TYPE_VALUE}>+ Create Deduction Type</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount<Required /></Label>
                <Input inputMode="decimal" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frequency<Required /></Label>
                <Select value={form.frequency} onValueChange={(value) => setForm((prev) => ({ ...prev, frequency: value as "PER_PAYROLL" | "MONTHLY" }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_PAYROLL">Per Payroll</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Effective From<Required /></Label>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remarks</Label>
                <Input value={form.remarks} onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Percentage Rate</Label>
                <Input inputMode="decimal" value={form.percentageRate} onChange={(event) => setForm((prev) => ({ ...prev, percentageRate: event.target.value }))} disabled={!form.isPercentage} />
              </div>
              <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3 mt-6">
                <span className="text-xs text-muted-foreground">Percentage-based deduction</span>
                <Checkbox id="is-percentage" checked={form.isPercentage} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isPercentage: checked === true }))} />
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border/60 pt-3">
              <Button type="button" size="sm" onClick={handleCreateRecurringDeduction} disabled={isPending}>{isPending ? "Saving..." : selectedRecordId ? "Update" : "Save"}</Button>
              <Button type="button" size="sm" variant="outline" onClick={handleCreateNew}>Clear</Button>
            </div>
          </div>
        </aside>
      </section>

      <Dialog open={deductionTypeDialogOpen} onOpenChange={setDeductionTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Deduction Type</DialogTitle>
            <DialogDescription>Add a reusable deduction type for recurring deductions.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Code <span className="text-destructive">*</span></Label>
              <Input value={deductionTypeForm.code} onChange={(event) => setDeductionTypeForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))} placeholder="e.g. HMO_CONTRIB" />
            </div>
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={deductionTypeForm.name} onChange={(event) => setDeductionTypeForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="e.g. HMO Contribution" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={deductionTypeForm.description} onChange={(event) => setDeductionTypeForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Payroll Timing</Label>
                <Select value={deductionTypeForm.payPeriodApplicability} onValueChange={(value) => setDeductionTypeForm((prev) => ({ ...prev, payPeriodApplicability: value as "EVERY_PAYROLL" | "FIRST_HALF" | "SECOND_HALF" }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EVERY_PAYROLL">Every Payroll</SelectItem>
                    <SelectItem value="FIRST_HALF">First Half</SelectItem>
                    <SelectItem value="SECOND_HALF">Second Half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deduction-type-pretax">Pre-tax Deduction</Label>
                <div className="flex h-9 items-center gap-2 px-3">
                  <Checkbox id="deduction-type-pretax" checked={deductionTypeForm.isPreTax} onCheckedChange={(checked) => setDeductionTypeForm((prev) => ({ ...prev, isPreTax: checked === true }))} />
                  <span className="text-sm">Enabled</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeductionTypeDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleCreateDeductionType} disabled={isPending}>Create Deduction Type</Button>
          </DialogFooter>
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
