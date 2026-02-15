"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PayrollRunType } from "@prisma/client"
import { IconInfoCircle } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
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
          <div className="flex h-10 items-center justify-between rounded-md border border-border/60 px-3">
            <p className="text-xs text-muted-foreground">Enable dry-run for selected type.</p>
            <Switch checked={isTrialRun} onCheckedChange={setIsTrialRun} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium text-foreground">Departments (optional)</p>
          <div className="max-h-40 space-y-2 overflow-auto pr-1">
            {departments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No departments available.</p>
            ) : (
              departments.map((department) => (
                <div key={department.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={departmentIds.includes(department.id)}
                    onCheckedChange={() => setDepartmentIds((prev) => toggleValue(prev, department.id))}
                  />
                  <Label className="text-xs font-normal">{department.name}</Label>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium text-foreground">Branches (optional)</p>
          <div className="max-h-40 space-y-2 overflow-auto pr-1">
            {branches.length === 0 ? (
              <p className="text-xs text-muted-foreground">No branches available.</p>
            ) : (
              branches.map((branch) => (
                <div key={branch.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={branchIds.includes(branch.id)}
                    onCheckedChange={() => setBranchIds((prev) => toggleValue(prev, branch.id))}
                  />
                  <Label className="text-xs font-normal">{branch.name}</Label>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium text-foreground">Employees (optional)</p>
          <Input
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Search employee name or number..."
            className="h-8"
          />
          <div className="max-h-40 space-y-2 overflow-auto pr-1">
            {filteredEmployees.length === 0 ? (
              <p className="text-xs text-muted-foreground">No employees matched your search.</p>
            ) : (
              filteredEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={employeeIds.includes(employee.id)}
                    onCheckedChange={() => setEmployeeIds((prev) => toggleValue(prev, employee.id))}
                  />
                  <Label className="text-xs font-normal">
                    {employee.fullName}
                    <span className="ml-1 text-muted-foreground">({employee.employeeNumber})</span>
                  </Label>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-border/60 pt-3">
        <Button type="button" onClick={handleSubmit} disabled={isPending || !canSubmit}>
          {isPending ? "Creating..." : "Create Payroll Run"}
        </Button>
      </div>
    </div>
  )
}
