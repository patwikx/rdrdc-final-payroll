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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createPayrollRunAction } from "@/modules/payroll/actions/payroll-run-actions"

type CreatePayrollRunFormProps = {
  companyId: string
  payPeriods: Array<{ id: string; label: string }>
  defaultPayPeriodId?: string
  runTypes: Array<{ code: PayrollRunType; label: string }>
  departments: Array<{ id: string; name: string }>
  branches: Array<{ id: string; name: string }>
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
  embedded = false,
  onSuccess,
}: CreatePayrollRunFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [payPeriodId] = useState<string>(defaultPayPeriodId ?? payPeriods[0]?.id ?? "")
  const [runTypeCode, setRunTypeCode] = useState<PayrollRunType>(runTypes[0]?.code ?? PayrollRunType.REGULAR)
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [branchIds, setBranchIds] = useState<string[]>([])

  const canSubmit = useMemo(() => payPeriodId.length > 0, [payPeriodId])
  const selectedPayPeriodLabel = useMemo(
    () => payPeriods.find((period) => period.id === payPeriodId)?.label ?? "No open pay period available",
    [payPeriodId, payPeriods]
  )

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
        departmentIds,
        branchIds,
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
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Pay Period<Required /></Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground" aria-label="Pay period selection policy">
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
          <Select value={runTypeCode} onValueChange={(value) => setRunTypeCode(value as PayrollRunType)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {runTypes.map((type) => (
                <SelectItem key={type.code} value={type.code}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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
      </div>

      <div className="flex justify-end border-t border-border/60 pt-3">
        <Button type="button" onClick={handleSubmit} disabled={isPending || !canSubmit}>
          {isPending ? "Creating..." : "Create Payroll Run"}
        </Button>
      </div>
    </div>
  )
}
