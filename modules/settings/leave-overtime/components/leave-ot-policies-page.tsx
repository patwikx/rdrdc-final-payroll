"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { IconCalendarClock, IconCheck, IconPlus, IconX } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { initializeLeaveBalancesForYearAction } from "@/modules/settings/leave-overtime/actions/initialize-leave-balances-for-year-action"
import { upsertLeaveTypePolicySettingsAction } from "@/modules/settings/leave-overtime/actions/upsert-leave-type-policy-settings-action"
import { upsertOvertimeRateSettingsAction } from "@/modules/settings/leave-overtime/actions/upsert-overtime-rate-settings-action"
import {
  leaveAccrualMethodOptions,
  leaveProrationMethodOptions,
  overtimeTypeOptions,
  type UpsertLeaveTypePolicySettingsInput,
  type UpsertOvertimeRateSettingsInput,
} from "@/modules/settings/leave-overtime/schemas/leave-ot-policy-settings-schema"

type LeaveOtPoliciesPageProps = {
  companyId: string
  companyName: string
  leaveTypes: Array<{
    id: string
    code: string
    name: string
    description: string | null
    isPaid: boolean
    isCarriedOver: boolean
    maxCarryOverDays: number | null
    allowHalfDay: boolean
    requiresApproval: boolean
    statusApplicability: string
    isActive: boolean
    primaryPolicy: {
      id: string
      employmentStatusId: string
      annualEntitlement: number
      accrualMethodCode: string
      prorationMethodCode: string
      effectiveFrom: string
    } | null
  }>
  employmentStatuses: Array<{
    id: string
    code: string
    name: string
    isActive: boolean
  }>
  overtimeRates: Array<{
    id: string
    overtimeTypeCode: string
    description: string | null
    rateMultiplier: number
    isActive: boolean
    effectiveFrom: string
  }>
}

type PolicyTab = "leave" | "ot"

const Required = () => <span className="ml-1 text-destructive">*</span>

const toDateValue = (date?: Date): string => {
  if (!date) return ""
  return format(date, "yyyy-MM-dd")
}

const fromDateValue = (value: string): Date | undefined => {
  if (!value) return undefined
  return new Date(`${value}T00:00:00+08:00`)
}

const getOvertimeTypeLabel = (code: string): string => {
  const matched = overtimeTypeOptions.find((option) => option.code === code)
  return matched?.label ?? code
}

const getAccrualLabel = (code: string): string => {
  const matched = leaveAccrualMethodOptions.find((option) => option.code === code)
  return matched?.label ?? code
}

const createLeaveForm = (
  companyId: string,
  employmentStatusId: string,
  leaveType?: LeaveOtPoliciesPageProps["leaveTypes"][number]
): UpsertLeaveTypePolicySettingsInput => ({
  companyId,
  leaveTypeId: leaveType?.id,
  policyId: leaveType?.primaryPolicy?.id,
  code: leaveType?.code ?? "",
  name: leaveType?.name ?? "",
  description: leaveType?.description ?? "",
  isPaid: leaveType?.isPaid ?? true,
  isCarriedOver: leaveType?.isCarriedOver ?? false,
  maxCarryOverDays: leaveType?.maxCarryOverDays ?? 0,
  allowHalfDay: leaveType?.allowHalfDay ?? true,
  requiresApproval: leaveType?.requiresApproval ?? true,
  statusApplicability:
    leaveType?.statusApplicability === "REGULAR_ONLY" || leaveType?.statusApplicability === "ALL"
      ? leaveType.statusApplicability
      : "ALL",
  isActive: leaveType?.isActive ?? true,
  employmentStatusId: leaveType?.primaryPolicy?.employmentStatusId ?? employmentStatusId,
  annualEntitlement: leaveType?.primaryPolicy?.annualEntitlement ?? 0,
  accrualMethodCode:
    leaveType?.primaryPolicy?.accrualMethodCode === "UPFRONT" ||
    leaveType?.primaryPolicy?.accrualMethodCode === "MONTHLY" ||
    leaveType?.primaryPolicy?.accrualMethodCode === "QUARTERLY" ||
    leaveType?.primaryPolicy?.accrualMethodCode === "PER_PAYROLL"
      ? leaveType.primaryPolicy.accrualMethodCode
      : "MONTHLY",
  prorationMethodCode:
    leaveType?.primaryPolicy?.prorationMethodCode === "FULL" ||
    leaveType?.primaryPolicy?.prorationMethodCode === "PRORATED_DAY" ||
    leaveType?.primaryPolicy?.prorationMethodCode === "PRORATED_MONTH"
      ? leaveType.primaryPolicy.prorationMethodCode
      : "PRORATED_MONTH",
  effectiveFrom: leaveType?.primaryPolicy?.effectiveFrom ?? toDateValue(new Date()),
})

const createOtForm = (companyId: string, overtimeRate?: LeaveOtPoliciesPageProps["overtimeRates"][number]): UpsertOvertimeRateSettingsInput => ({
  companyId,
  overtimeRateId: overtimeRate?.id,
  overtimeTypeCode:
    overtimeRate?.overtimeTypeCode === "REGULAR_OT" ||
    overtimeRate?.overtimeTypeCode === "REST_DAY_OT" ||
    overtimeRate?.overtimeTypeCode === "SPECIAL_HOLIDAY_OT" ||
    overtimeRate?.overtimeTypeCode === "REGULAR_HOLIDAY_OT" ||
    overtimeRate?.overtimeTypeCode === "REST_DAY_HOLIDAY_OT" ||
    overtimeRate?.overtimeTypeCode === "NIGHT_DIFF"
      ? overtimeRate.overtimeTypeCode
      : "REGULAR_OT",
  description: overtimeRate?.description ?? "",
  rateMultiplier: overtimeRate?.rateMultiplier ?? 1.25,
  isActive: overtimeRate?.isActive ?? true,
  effectiveFrom: overtimeRate?.effectiveFrom ?? toDateValue(new Date()),
})

const StatusBadge = ({ active }: { active: boolean }) => {
  return (
    <Badge
      variant={active ? "default" : "secondary"}
      className={active ? "bg-green-600 text-white hover:bg-green-600" : ""}
    >
      <span className="inline-flex items-center gap-1">
        {active ? <IconCheck className="size-3" /> : <IconX className="size-3" />}
        {active ? "ACTIVE" : "INACTIVE"}
      </span>
    </Badge>
  )
}

export function LeaveOtPoliciesPage({
  companyId,
  companyName,
  leaveTypes,
  employmentStatuses,
  overtimeRates,
}: LeaveOtPoliciesPageProps) {
  const router = useRouter()

  const [tab, setTab] = useState<PolicyTab>("leave")
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string | null>(leaveTypes[0]?.id ?? null)
  const [selectedOvertimeRateId, setSelectedOvertimeRateId] = useState<string | null>(overtimeRates[0]?.id ?? null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isSavingLeave, startSavingLeave] = useTransition()
  const [isSavingOt, startSavingOt] = useTransition()
  const [initializationYear, setInitializationYear] = useState<number>(() => {
    const value = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
    }).format(new Date())
    return Number(value)
  })

  const defaultEmploymentStatusId = employmentStatuses[0]?.id ?? ""

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((item) => item.id === selectedLeaveTypeId),
    [leaveTypes, selectedLeaveTypeId]
  )

  const selectedOvertimeRate = useMemo(
    () => overtimeRates.find((item) => item.id === selectedOvertimeRateId),
    [overtimeRates, selectedOvertimeRateId]
  )

  const [leaveForm, setLeaveForm] = useState<UpsertLeaveTypePolicySettingsInput>(
    createLeaveForm(companyId, defaultEmploymentStatusId, selectedLeaveType)
  )
  const [otForm, setOtForm] = useState<UpsertOvertimeRateSettingsInput>(createOtForm(companyId, selectedOvertimeRate))

  useEffect(() => {
    setLeaveForm(createLeaveForm(companyId, defaultEmploymentStatusId, selectedLeaveType))
  }, [companyId, defaultEmploymentStatusId, selectedLeaveType])

  useEffect(() => {
    setOtForm(createOtForm(companyId, selectedOvertimeRate))
  }, [companyId, selectedOvertimeRate])

  const handleInitializeLeaveBalances = async () => {
    if (!Number.isInteger(initializationYear) || initializationYear < 2000 || initializationYear > 2100) {
      toast.error("Please enter a valid year between 2000 and 2100.")
      return
    }

    setIsInitializing(true)
    const result = await initializeLeaveBalancesForYearAction({ companyId, year: initializationYear })
    setIsInitializing(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(
      `${result.message} Created: ${result.stats.balancesCreated}, existing: ${result.stats.balancesSkippedExisting}, no policy: ${result.stats.balancesSkippedNoPolicy}.`
    )
    router.refresh()
  }

  const handleCreateNewLeave = () => {
    setSelectedLeaveTypeId(null)
    setLeaveForm(createLeaveForm(companyId, defaultEmploymentStatusId))
  }

  const handleCreateNewOt = () => {
    setSelectedOvertimeRateId(null)
    setOtForm(createOtForm(companyId))
  }

  const handleSaveLeave = () => {
    startSavingLeave(async () => {
      const result = await upsertLeaveTypePolicySettingsAction(leaveForm)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const handleSaveOt = () => {
    startSavingOt(async () => {
      const result = await upsertOvertimeRateSettingsAction(otForm)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"><IconCalendarClock className="size-5" /> {companyName} Leave / OT Policies</h1>
            <p className="text-sm text-muted-foreground">Manage leave and overtime policies using live configuration records.</p>
          </div>
          <div className="inline-flex rounded-md border border-border/60 bg-background p-1">
            <Button type="button" size="sm" variant={tab === "leave" ? "default" : "ghost"} onClick={() => setTab("leave")}>Leave Policies</Button>
            <Button type="button" size="sm" variant={tab === "ot" ? "default" : "ghost"} onClick={() => setTab("ot")}>OT Policies</Button>
          </div>
        </div>
      </header>

      <section className="grid border-y border-border/60 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="xl:border-r xl:border-border/60">
          {tab === "leave" ? (
            <div className="border-b border-border/60 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">Leave Balance Initialization</h3>
                  <p className="text-xs text-muted-foreground">Initialize yearly leave balances based on active leave policies.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Year<Required /></Label>
                  <Input
                    type="number"
                    value={initializationYear}
                    min={2000}
                    max={2100}
                    onChange={(event) => setInitializationYear(Number(event.target.value) || 0)}
                    className="h-7 w-28"
                  />
                  <Button type="button" onClick={handleInitializeLeaveBalances} disabled={isInitializing}>
                    {isInitializing ? "Initializing..." : "Initialize"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="border-b border-border/60 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-semibold text-foreground">{tab === "leave" ? "Leave Types" : "OT Policy Rules"}</h2>
                <p className="text-xs text-muted-foreground">
                  {tab === "leave"
                    ? "Company leave types with primary entitlement policy."
                    : "Current overtime multipliers per overtime type."}
                </p>
              </div>
              <Button type="button" onClick={tab === "leave" ? handleCreateNewLeave : handleCreateNewOt}><IconPlus className="size-3.5" /> Add New</Button>
            </div>
          </div>
          <div className="px-4 py-3 sm:px-6">
            {tab === "leave" ? (
              <div className="space-y-3">
                <div className="overflow-x-auto border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Leave Type</th>
                        <th className="px-3 py-2 text-left">Paid</th>
                        <th className="px-3 py-2 text-left">Accrual</th>
                        <th className="px-3 py-2 text-left">Eligibility</th>
                        <th className="px-3 py-2 text-left">Carry Forward</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveTypes.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "cursor-pointer border-t border-border/50 hover:bg-muted/30",
                            selectedLeaveTypeId === row.id ? "bg-primary text-primary-foreground hover:bg-primary" : ""
                          )}
                          onClick={() => setSelectedLeaveTypeId(row.id)}
                        >
                          <td className="px-3 py-2">{row.code}</td>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">{row.isPaid ? "Yes" : "No"}</td>
                          <td className="px-3 py-2">{row.primaryPolicy ? getAccrualLabel(row.primaryPolicy.accrualMethodCode) : "-"}</td>
                          <td className="px-3 py-2">{row.statusApplicability === "REGULAR_ONLY" ? "Regular Only" : "All (incl. Probationary)"}</td>
                          <td className="px-3 py-2">{row.isCarriedOver ? `${row.maxCarryOverDays ?? 0} max days` : "No"}</td>
                          <td className="px-3 py-2"><StatusBadge active={row.isActive} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-border/60">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Multiplier</th>
                      <th className="px-3 py-2 text-left">Effective</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overtimeRates.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "cursor-pointer border-t border-border/50 hover:bg-muted/30",
                          selectedOvertimeRateId === row.id ? "bg-primary text-primary-foreground hover:bg-primary" : ""
                        )}
                        onClick={() => setSelectedOvertimeRateId(row.id)}
                      >
                        <td className="px-3 py-2">{getOvertimeTypeLabel(row.overtimeTypeCode)}</td>
                        <td className="px-3 py-2">{row.rateMultiplier.toFixed(2)}x</td>
                        <td className="px-3 py-2">{row.effectiveFrom}</td>
                        <td className="px-3 py-2"><StatusBadge active={row.isActive} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="xl:sticky xl:top-20 xl:h-fit">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-base font-medium text-foreground">
              {tab === "leave"
                ? selectedLeaveTypeId
                  ? "Edit Leave Policy"
                  : "New Leave Policy"
                : selectedOvertimeRateId
                  ? "Edit OT Policy"
                  : "New OT Policy"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tab === "leave"
                ? "Save leave type configuration with one primary entitlement policy."
                : "Save overtime multiplier and effectivity."}
            </p>
          </div>
          <div className="grid gap-3 px-4 py-3">
            {tab === "leave" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Code<Required /></Label>
                    <Input value={leaveForm.code} onChange={(event) => setLeaveForm((prev) => ({ ...prev, code: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name<Required /></Label>
                    <Input value={leaveForm.name} onChange={(event) => setLeaveForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={leaveForm.description ?? ""} onChange={(event) => setLeaveForm((prev) => ({ ...prev, description: event.target.value }))} className="h-16" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employment Status<Required /></Label>
                    <Select value={leaveForm.employmentStatusId} onValueChange={(value) => setLeaveForm((prev) => ({ ...prev, employmentStatusId: value }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {employmentStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Annual Entitlement<Required /></Label>
                    <Input type="number" min={0} step="0.25" value={leaveForm.annualEntitlement} onChange={(event) => setLeaveForm((prev) => ({ ...prev, annualEntitlement: Number(event.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Accrual Method<Required /></Label>
                    <Select value={leaveForm.accrualMethodCode} onValueChange={(value) => setLeaveForm((prev) => ({ ...prev, accrualMethodCode: value as UpsertLeaveTypePolicySettingsInput["accrualMethodCode"] }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {leaveAccrualMethodOptions.map((option) => (
                          <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Proration Method<Required /></Label>
                    <Select value={leaveForm.prorationMethodCode} onValueChange={(value) => setLeaveForm((prev) => ({ ...prev, prorationMethodCode: value as UpsertLeaveTypePolicySettingsInput["prorationMethodCode"] }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {leaveProrationMethodOptions.map((option) => (
                          <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Effective From<Required /></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left", !leaveForm.effectiveFrom && "text-muted-foreground")}>
                        {leaveForm.effectiveFrom || "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fromDateValue(leaveForm.effectiveFrom)}
                        onSelect={(date) => setLeaveForm((prev) => ({ ...prev, effectiveFrom: toDateValue(date) }))}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Leave Eligibility<Required /></Label>
                  <Select
                    value={leaveForm.statusApplicability}
                    onValueChange={(value) =>
                      setLeaveForm((prev) => ({
                        ...prev,
                        statusApplicability: value as UpsertLeaveTypePolicySettingsInput["statusApplicability"],
                      }))
                    }
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All employees (including probationary)</SelectItem>
                      <SelectItem value="REGULAR_ONLY">Regular employees only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3">
                    <span className="text-xs text-muted-foreground">Paid leave</span>
                    <Switch checked={leaveForm.isPaid} onCheckedChange={(value) => setLeaveForm((prev) => ({ ...prev, isPaid: value }))} />
                  </div>
                  <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3">
                    <span className="text-xs text-muted-foreground">Allow half day</span>
                    <Switch checked={leaveForm.allowHalfDay} onCheckedChange={(value) => setLeaveForm((prev) => ({ ...prev, allowHalfDay: value }))} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3">
                    <span className="text-xs text-muted-foreground">Carry-over enabled</span>
                    <Switch checked={leaveForm.isCarriedOver} onCheckedChange={(value) => setLeaveForm((prev) => ({ ...prev, isCarriedOver: value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Carry-over Days</Label>
                    <Input type="number" min={0} step="0.25" value={leaveForm.maxCarryOverDays ?? 0} onChange={(event) => setLeaveForm((prev) => ({ ...prev, maxCarryOverDays: Number(event.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3">
                    <span className="text-xs text-muted-foreground">Requires approval</span>
                    <Switch checked={leaveForm.requiresApproval} onCheckedChange={(value) => setLeaveForm((prev) => ({ ...prev, requiresApproval: value }))} />
                  </div>
                  <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3">
                    <span className="text-xs text-muted-foreground">Active</span>
                    <Switch checked={leaveForm.isActive} onCheckedChange={(value) => setLeaveForm((prev) => ({ ...prev, isActive: value }))} />
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                  <Button type="button" size="sm" onClick={handleSaveLeave} disabled={isSavingLeave}>{isSavingLeave ? "Saving..." : "Save"}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleCreateNewLeave}>Clear</Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Overtime Type<Required /></Label>
                  <Select value={otForm.overtimeTypeCode} onValueChange={(value) => setOtForm((prev) => ({ ...prev, overtimeTypeCode: value as UpsertOvertimeRateSettingsInput["overtimeTypeCode"] }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {overtimeTypeOptions.map((option) => (
                        <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Multiplier<Required /></Label>
                  <Input type="number" min={0.5} max={10} step="0.05" value={otForm.rateMultiplier} onChange={(event) => setOtForm((prev) => ({ ...prev, rateMultiplier: Number(event.target.value) || 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Effective From<Required /></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left", !otForm.effectiveFrom && "text-muted-foreground")}>
                        {otForm.effectiveFrom || "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fromDateValue(otForm.effectiveFrom)}
                        onSelect={(date) => setOtForm((prev) => ({ ...prev, effectiveFrom: toDateValue(date) }))}
                        captionLayout="dropdown"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea className="h-20" value={otForm.description ?? ""} onChange={(event) => setOtForm((prev) => ({ ...prev, description: event.target.value }))} />
                </div>
                <div className="flex h-9 items-center justify-between rounded-md border border-input bg-background px-3">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch checked={otForm.isActive} onCheckedChange={(value) => setOtForm((prev) => ({ ...prev, isActive: value }))} />
                </div>
                <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                  <Button type="button" size="sm" onClick={handleSaveOt} disabled={isSavingOt}>{isSavingOt ? "Saving..." : "Save"}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleCreateNewOt}>Clear</Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}
