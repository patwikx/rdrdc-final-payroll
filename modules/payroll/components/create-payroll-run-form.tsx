"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PayrollRunType } from "@prisma/client"
import { IconBuilding, IconInfoCircle, IconMapPin, IconSearch, IconUsers } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createPayrollRunAction } from "@/modules/payroll/actions/payroll-run-actions"

type NonTrialRunType = Exclude<PayrollRunType, "TRIAL_RUN">

type CreatePayrollRunFormProps = {
  companyId: string
  payPeriods: Array<{ id: string; label: string }>
  defaultPayPeriodId?: string
  runTypes: Array<{ code: NonTrialRunType; label: string }>
  departments: Array<{ id: string; name: string }>
  branches: Array<{ id: string; name: string }>
  employees: Array<{ id: string; employeeNumber: string; fullName: string }>
  embedded?: boolean
  onSuccess?: () => void
}

const Required = () => <span className="ml-1 text-destructive">*</span>

export function CreatePayrollRunForm({
  companyId,
  payPeriods,
  defaultPayPeriodId,
  runTypes,
  departments,
  branches,
  employees,
  embedded = false,
  onSuccess,
}: CreatePayrollRunFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [payPeriodId] = useState<string>(defaultPayPeriodId ?? payPeriods[0]?.id ?? "")
  const [runTypeCode, setRunTypeCode] = useState<NonTrialRunType>(runTypes[0]?.code ?? PayrollRunType.REGULAR)
  const [isTrialRun, setIsTrialRun] = useState(false)
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [payPeriodTooltipOpen, setPayPeriodTooltipOpen] = useState(false)

  const canSubmit = useMemo(() => payPeriodId.length > 0, [payPeriodId])
  const selectedPayPeriodLabel = useMemo(
    () => payPeriods.find((period) => period.id === payPeriodId)?.label ?? "No open pay period available",
    [payPeriodId, payPeriods]
  )
  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase()
    if (!query) return employees

    return employees.filter((employee) => {
      return `${employee.fullName} ${employee.employeeNumber}`.toLowerCase().includes(query)
    })
  }, [employeeSearch, employees])

  const toggleValue = (values: string[], value: string): string[] => {
    if (values.includes(value)) return values.filter((entry) => entry !== value)
    return [...values, value]
  }

  const selectAllDepartments = () => setDepartmentIds(departments.map((department) => department.id))
  const selectAllBranches = () => setBranchIds(branches.map((branch) => branch.id))
  const selectAllFilteredEmployees = () =>
    setEmployeeIds((previous) => {
      const next = new Set(previous)
      filteredEmployees.forEach((employee) => next.add(employee.id))
      return Array.from(next)
    })

  const handleSubmit = () => {
    if (!canSubmit) {
      toast.error("Select a pay period first.")
      return
    }

    startTransition(async () => {
      const result = await createPayrollRunAction({
        companyId,
        payPeriodId,
        runTypeCode,
        isTrialRun,
        departmentIds,
        branchIds,
        employeeIds,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      onSuccess?.()
      if (result.runId) {
        router.push(`/${companyId}/payroll/runs/${result.runId}`)
      } else {
        router.push(`/${companyId}/payroll/runs`)
      }
    })
  }

  return (
    <div className={embedded ? "space-y-4" : "space-y-4 rounded-xl border border-border/70 bg-card/80 p-4"}>
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-3 border border-border/60 bg-background px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Run Configuration</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Pay Period<Required /></Label>
                <TooltipProvider>
                  <Tooltip
                    open={payPeriodTooltipOpen}
                    onOpenChange={(nextOpen) => {
                      if (!nextOpen) {
                        setPayPeriodTooltipOpen(false)
                      }
                    }}
                  >
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground"
                        aria-label="Pay period selection policy"
                        onPointerEnter={() => setPayPeriodTooltipOpen(true)}
                        onPointerLeave={() => setPayPeriodTooltipOpen(false)}
                        onPointerDown={() => setPayPeriodTooltipOpen(false)}
                        onBlur={() => setPayPeriodTooltipOpen(false)}
                      >
                        <IconInfoCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={8}>
                      Auto-selected based on next unlocked payroll period.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input value={selectedPayPeriodLabel} disabled className="w-full" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Run Type<Required /></Label>
              <Select value={runTypeCode} onValueChange={(value) => setRunTypeCode(value as NonTrialRunType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {runTypes.map((type) => (
                    <SelectItem key={type.code} value={type.code}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Trial Run</Label>
              <div className="flex h-10 items-center justify-between border border-border/60 px-3">
                <p className="text-xs text-muted-foreground">Dry run only</p>
                <Switch checked={isTrialRun} onCheckedChange={setIsTrialRun} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 border border-border/60 bg-background px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Scope Summary</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconBuilding className="mr-1 size-3.5" />
              {departmentIds.length} Department{departmentIds.length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconMapPin className="mr-1 size-3.5" />
              {branchIds.length} Branch{branchIds.length === 1 ? "" : "es"}
            </Badge>
            <Badge variant="outline" className="h-6 px-2 text-[11px]">
              <IconUsers className="mr-1 size-3.5" />
              {employeeIds.length} Employee{employeeIds.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave all scope lists unselected to run payroll for all employees in this pay period.
          </p>
          <p className="text-xs text-muted-foreground">
            If employees are selected, the run is limited to the selected employees.
          </p>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="flex h-[320px] min-h-0 flex-col space-y-2 border border-border/60 bg-background px-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Departments (optional)</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={selectAllDepartments}>
                All
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setDepartmentIds([])}>
                Clear
              </Button>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="space-y-2">
              {departments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No departments available.</p>
              ) : (
                departments.map((department) => (
                  <div key={department.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`department-${department.id}`}
                      checked={departmentIds.includes(department.id)}
                      onCheckedChange={() => setDepartmentIds((prev) => toggleValue(prev, department.id))}
                    />
                    <Label htmlFor={`department-${department.id}`} className="text-xs font-normal">
                      {department.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex h-[320px] min-h-0 flex-col space-y-2 border border-border/60 bg-background px-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Branches (optional)</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={selectAllBranches}>
                All
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setBranchIds([])}>
                Clear
              </Button>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="space-y-2">
              {branches.length === 0 ? (
                <p className="text-xs text-muted-foreground">No branches available.</p>
              ) : (
                branches.map((branch) => (
                  <div key={branch.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`branch-${branch.id}`}
                      checked={branchIds.includes(branch.id)}
                      onCheckedChange={() => setBranchIds((prev) => toggleValue(prev, branch.id))}
                    />
                    <Label htmlFor={`branch-${branch.id}`} className="text-xs font-normal">
                      {branch.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex h-[320px] min-h-0 flex-col space-y-2 border border-border/60 bg-background px-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Employees (optional)</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={selectAllFilteredEmployees}>
                Select Filtered
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setEmployeeIds([])}>
                Clear
              </Button>
            </div>
          </div>
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="Search employee name or number..."
              className="h-8 pl-8"
            />
          </div>
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="space-y-2">
              {filteredEmployees.length === 0 ? (
                <p className="text-xs text-muted-foreground">No employees matched your search.</p>
              ) : (
                filteredEmployees.map((employee) => (
                  <div key={employee.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`employee-${employee.id}`}
                      checked={employeeIds.includes(employee.id)}
                      onCheckedChange={() => setEmployeeIds((prev) => toggleValue(prev, employee.id))}
                    />
                    <Label htmlFor={`employee-${employee.id}`} className="text-xs font-normal">
                      {employee.fullName}
                      <span className="ml-1 text-muted-foreground">({employee.employeeNumber})</span>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </section>

      <div className="flex justify-end border-t border-border/60 pt-3">
        <Button type="button" onClick={handleSubmit} disabled={isPending || !canSubmit}>
          {isPending ? "Creating..." : "Create Payroll Run"}
        </Button>
      </div>
    </div>
  )
}
