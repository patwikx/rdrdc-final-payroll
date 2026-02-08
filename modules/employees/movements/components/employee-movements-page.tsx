"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { IconCalendarEvent, IconCheck, IconChevronRight, IconGitBranch, IconUser } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { createEmployeeMovementAction } from "@/modules/employees/movements/actions/create-employee-movement-action"
import type { EmployeeMovementsViewModel } from "@/modules/employees/movements/utils/get-employee-movements-data"

type MovementKind = "status" | "position" | "rank" | "salary" | "schedule"

const movementTypeOptions = ["PROMOTION", "TRANSFER", "DEMOTION", "LATERAL"] as const
const salaryAdjustmentOptions = ["INCREASE", "DECREASE", "PROMOTION", "DEMOTION", "MARKET_ADJUSTMENT", "OTHER"] as const

const formatDisplayDate = (value: string): string => {
  if (!value) return ""
  const parsed = new Date(`${value}T00:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) return ""
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "2-digit", year: "numeric", timeZone: "Asia/Manila" }).format(parsed)
}

const toPhDateInputValue = (date: Date | undefined): string => {
  if (!date) return ""
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(date)
}

export function EmployeeMovementsPage({
  data,
  designVariant = 1,
}: {
  data: EmployeeMovementsViewModel
  designVariant?: 1 | 2 | 3 | 4 | 5
}) {
  const [isPending, startTransition] = useTransition()

  // Form state
  const [movementKind, setMovementKind] = useState<MovementKind>("status")
  const [employeeId, setEmployeeId] = useState("")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [reason, setReason] = useState("")
  const [remarks, setRemarks] = useState("")

  // Movement-specific state
  const [newStatusId, setNewStatusId] = useState("")
  const [newPositionId, setNewPositionId] = useState("")
  const [newDepartmentId, setNewDepartmentId] = useState("")
  const [newBranchId, setNewBranchId] = useState("")
  const [positionMovementType, setPositionMovementType] = useState<(typeof movementTypeOptions)[number]>("PROMOTION")
  const [newRankId, setNewRankId] = useState("")
  const [rankMovementType, setRankMovementType] = useState<(typeof movementTypeOptions)[number]>("PROMOTION")
  const [newSalary, setNewSalary] = useState("")
  const [adjustmentTypeCode, setAdjustmentTypeCode] = useState<(typeof salaryAdjustmentOptions)[number]>("INCREASE")
  const [newScheduleId, setNewScheduleId] = useState("")

  // Wizard state (for iteration 4)
  const [wizardStep, setWizardStep] = useState(1)

  const selectedEmployee = data.options.employees.find((e) => e.id === employeeId)

  const onSubmit = () => {
    if (!employeeId || !effectiveDate) {
      toast.error("Employee and effective date are required.")
      return
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createEmployeeMovementAction>> | undefined

      if (movementKind === "status") {
        if (!newStatusId) { toast.error("Please select new status."); return }
        result = await createEmployeeMovementAction({ movementKind: "STATUS", companyId: data.companyId, employeeId, effectiveDate, newStatusId, reason, remarks })
      }
      if (movementKind === "position") {
        if (!newPositionId) { toast.error("Please select new position."); return }
        result = await createEmployeeMovementAction({ movementKind: "POSITION", companyId: data.companyId, employeeId, effectiveDate, newPositionId, newDepartmentId: newDepartmentId || undefined, newBranchId: newBranchId || undefined, movementType: positionMovementType, reason, remarks })
      }
      if (movementKind === "rank") {
        if (!newRankId) { toast.error("Please select new rank."); return }
        result = await createEmployeeMovementAction({ movementKind: "RANK", companyId: data.companyId, employeeId, effectiveDate, newRankId, movementType: rankMovementType, reason, remarks })
      }
      if (movementKind === "salary") {
        const num = Number(newSalary)
        if (Number.isNaN(num) || num <= 0) { toast.error("Please enter valid salary."); return }
        result = await createEmployeeMovementAction({ movementKind: "SALARY", companyId: data.companyId, employeeId, effectiveDate, newSalary: num, adjustmentTypeCode, reason, remarks })
      }
      if (movementKind === "schedule") {
        if (!newScheduleId) { toast.error("Please select new schedule."); return }
        result = await createEmployeeMovementAction({ movementKind: "SCHEDULE", companyId: data.companyId, employeeId, effectiveDate, newScheduleId, reason, remarks })
      }

      if (!result) { toast.error("Unable to process."); return }
      if (!result.ok) { toast.error(result.error); return }
      toast.success(result.message)
      setWizardStep(1)
    })
  }

  const allHistory = [...data.recentHistory.status, ...data.recentHistory.position, ...data.recentHistory.rank, ...data.recentHistory.salary, ...data.recentHistory.schedule]
  const employeeHistory = allHistory.filter((h) => {
    const emp = data.options.employees.find((e) => e.label === h.employee)
    return emp?.id === employeeId
  })

  // ─────────────────────────────────────────────────────────────────
  // Reusable UI Pieces
  // ─────────────────────────────────────────────────────────────────

  const renderEmployeeSelector = ({ showLabel = true }: { showLabel?: boolean } = {}) => (
    <div className="space-y-1.5">
      {showLabel && <Label>Employee <span className="text-destructive">*</span></Label>}
      <Select value={employeeId} onValueChange={setEmployeeId}>
        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
        <SelectContent>
          {data.options.employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  const renderDatePicker = ({ showLabel = true }: { showLabel?: boolean } = {}) => (
    <div className="space-y-1.5">
      {showLabel && <Label>Effective Date <span className="text-destructive">*</span></Label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>{effectiveDate ? formatDisplayDate(effectiveDate) : "Select date"}</span>
            <IconCalendarEvent className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <Calendar mode="single" selected={effectiveDate ? new Date(`${effectiveDate}T00:00:00+08:00`) : undefined} onSelect={(d) => setEffectiveDate(toPhDateInputValue(d))} />
        </PopoverContent>
      </Popover>
    </div>
  )

  const renderMovementKindSelector = () => (
    <div className="space-y-1.5">
      <Label>What to Change <span className="text-destructive">*</span></Label>
      <Select value={movementKind} onValueChange={(v) => setMovementKind(v as MovementKind)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="status">Employment Status</SelectItem>
          <SelectItem value="position">Position / Department / Branch</SelectItem>
          <SelectItem value="rank">Rank Level</SelectItem>
          <SelectItem value="salary">Salary / Compensation</SelectItem>
          <SelectItem value="schedule">Work Schedule</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  const renderMovementDetails = () => (
    <div className="space-y-4">
      {movementKind === "status" && (
        <SelectField label="New Status *" value={newStatusId} onChange={setNewStatusId} options={data.options.statuses} placeholder="Select status" />
      )}
      {movementKind === "position" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="New Position *" value={newPositionId} onChange={setNewPositionId} options={data.options.positions} placeholder="Select position" />
          <SelectField label="Movement Type *" value={positionMovementType} onChange={(v) => setPositionMovementType(v as (typeof movementTypeOptions)[number])} options={movementTypeOptions.map((t) => ({ id: t, label: t }))} placeholder="Select type" />
          <SelectField label="Department" value={newDepartmentId} onChange={setNewDepartmentId} options={data.options.departments} placeholder="No change" allowNone />
          <SelectField label="Branch" value={newBranchId} onChange={setNewBranchId} options={data.options.branches} placeholder="No change" allowNone />
        </div>
      )}
      {movementKind === "rank" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="New Rank *" value={newRankId} onChange={setNewRankId} options={data.options.ranks} placeholder="Select rank" />
          <SelectField label="Movement Type *" value={rankMovementType} onChange={(v) => setRankMovementType(v as (typeof movementTypeOptions)[number])} options={movementTypeOptions.map((t) => ({ id: t, label: t }))} placeholder="Select type" />
        </div>
      )}
      {movementKind === "salary" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>New Salary <span className="text-destructive">*</span></Label>
            <Input inputMode="decimal" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder="e.g. 35000" />
          </div>
          <SelectField label="Adjustment Type *" value={adjustmentTypeCode} onChange={(v) => setAdjustmentTypeCode(v as (typeof salaryAdjustmentOptions)[number])} options={salaryAdjustmentOptions.map((t) => ({ id: t, label: t.replaceAll("_", " ") }))} placeholder="Select type" />
        </div>
      )}
      {movementKind === "schedule" && (
        <SelectField label="New Work Schedule *" value={newScheduleId} onChange={setNewScheduleId} options={data.options.schedules} placeholder="Select schedule" />
      )}
    </div>
  )

  const renderOptionalFields = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
      </div>
      <div className="space-y-1.5">
        <Label>Remarks</Label>
        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" rows={2} />
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="inline-flex items-center gap-2 text-2xl font-semibold"><IconGitBranch className="size-6" /> Employee Movements</h1>
          <p className="text-sm text-muted-foreground">Record changes to employee status, position, rank, salary, or schedule.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <Link key={v} href={`/${data.companyId}/employees/movements?variant=${v}`}>
              <Button variant={designVariant === v ? "default" : "outline"} size="sm">Layout {v}</Button>
            </Link>
          ))}
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          LAYOUT 1: UNIFIED FORM
          Single cohesive form. Movement type is a dropdown field.
          Clean, direct, no cognitive overhead from tabs.
      ════════════════════════════════════════════════════════════════ */}
      {designVariant === 1 && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader>
              <CardTitle>Record Movement</CardTitle>
              <CardDescription>All fields in one place. Select what you want to change.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                {renderEmployeeSelector()}
                {renderDatePicker()}
                {renderMovementKindSelector()}
              </div>
              <Separator />
              {renderMovementDetails()}
              <Separator />
              {renderOptionalFields()}
              <Button onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save Movement"}</Button>
            </CardContent>
          </Card>

          <Card className="h-fit xl:sticky xl:top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Movements</CardTitle>
              <CardDescription>{allHistory.length} total records</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {allHistory.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No movements recorded yet.</p>
                ) : (
                  <div className="space-y-2 pr-3">
                    {allHistory.slice(0, 20).map((row) => (
                      <div key={row.id} className="rounded-md border bg-muted/20 p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{row.employee}</span>
                          <Badge variant="outline" className="text-xs">{row.effectiveDate}</Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">{row.movement}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LAYOUT 2: EMPLOYEE-FIRST CONTEXT
          Select employee first, see their context, then make changes.
          Reduces errors by showing who you're modifying.
      ════════════════════════════════════════════════════════════════ */}
      {designVariant === 2 && (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left: Employee Selection & Context */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Step 1: Select Employee</CardTitle>
              </CardHeader>
              <CardContent>
                {renderEmployeeSelector({ showLabel: false })}
              </CardContent>
            </Card>

            {selectedEmployee && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/20">
                      <IconUser className="size-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{selectedEmployee.label}</CardTitle>
                      <CardDescription>Selected Employee</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {employeeHistory.length} previous movement(s) on record.
                  </p>
                </CardContent>
              </Card>
            )}

            {selectedEmployee && employeeHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Movement History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2 pr-3">
                      {employeeHistory.map((row) => (
                        <div key={row.id} className="border-l-2 border-primary/30 pl-3 text-sm">
                          <p className="font-medium">{row.movement}</p>
                          <p className="text-xs text-muted-foreground">{row.effectiveDate}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Movement Form */}
          <Card className={!employeeId ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader>
              <CardTitle>Step 2: Record Movement</CardTitle>
              <CardDescription>{employeeId ? `Making changes for ${selectedEmployee?.label}` : "Select an employee first"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {renderDatePicker()}
                {renderMovementKindSelector()}
              </div>
              <Separator />
              {renderMovementDetails()}
              <Separator />
              {renderOptionalFields()}
              <Button onClick={onSubmit} disabled={isPending || !employeeId}>{isPending ? "Saving..." : "Save Movement"}</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LAYOUT 3: COMPACT ACTION BAR + HISTORY TABLE
          Minimal form at top, prominent history table below.
          For users who do this frequently and want efficiency.
      ════════════════════════════════════════════════════════════════ */}
      {designVariant === 3 && (
        <div className="space-y-6">
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-48">{renderEmployeeSelector()}</div>
                <div className="w-40">{renderDatePicker()}</div>
                <div className="w-48">{renderMovementKindSelector()}</div>
                <div className="flex-1 min-w-[200px]">{renderMovementDetails()}</div>
                <Button onClick={onSubmit} disabled={isPending} className="h-9">{isPending ? "..." : "Save"}</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Movement Records</CardTitle>
              <CardDescription>Complete history across all employees and movement types.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium">Employee</th>
                      <th className="px-3 py-2.5 text-left font-medium">Change</th>
                      <th className="px-3 py-2.5 text-left font-medium">Effective</th>
                      <th className="px-3 py-2.5 text-left font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allHistory.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No records yet.</td></tr>
                    ) : (
                      allHistory.map((row) => (
                        <tr key={row.id} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-medium">{row.employee}</td>
                          <td className="px-3 py-2.5">{row.movement}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{row.effectiveDate}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{row.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LAYOUT 4: GUIDED WIZARD
          Step-by-step flow for new users or complex movements.
          Clear progress, review before submit.
      ════════════════════════════════════════════════════════════════ */}
      {designVariant === 4 && (
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Record Movement</CardTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                Step {wizardStep} of 4
              </div>
            </div>
            {/* Progress */}
            <div className="flex items-center gap-2 pt-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${wizardStep >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {wizardStep > s ? <IconCheck className="size-4" /> : s}
                  </div>
                  {s < 4 && <div className={`h-0.5 w-8 ${wizardStep > s ? "bg-primary" : "bg-muted"}`} />}
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="font-medium">Who and When?</h3>
                {renderEmployeeSelector()}
                {renderDatePicker()}
              </div>
            )}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="font-medium">What to Change?</h3>
                {renderMovementKindSelector()}
              </div>
            )}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h3 className="font-medium">New Values</h3>
                {renderMovementDetails()}
                <Separator />
                {renderOptionalFields()}
              </div>
            )}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <h3 className="font-medium">Review & Confirm</h3>
                <div className="rounded-md border bg-muted/20 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Employee</span><span className="font-medium">{selectedEmployee?.label || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Effective Date</span><span className="font-medium">{formatDisplayDate(effectiveDate) || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Change Type</span><span className="font-medium capitalize">{movementKind}</span></div>
                  {reason && <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span>{reason}</span></div>}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setWizardStep(Math.max(1, wizardStep - 1))} disabled={wizardStep === 1}>Back</Button>
              {wizardStep < 4 ? (
                <Button onClick={() => setWizardStep(wizardStep + 1)}>Continue <IconChevronRight className="size-4" /></Button>
              ) : (
                <Button onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Confirm & Save"}</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════
          LAYOUT 5: DUAL-PANE REVIEW MODE
          History on left for review, form on right for action.
          Good for auditing while creating new records.
      ════════════════════════════════════════════════════════════════ */}
      {designVariant === 5 && (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Left: History Review */}
          <Card>
            <CardHeader>
              <CardTitle>Movement History</CardTitle>
              <CardDescription>Review existing records before making changes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                {allHistory.length === 0 ? (
                  <p className="py-12 text-center text-muted-foreground">No records yet.</p>
                ) : (
                  <div className="space-y-3 pr-4">
                    {allHistory.map((row) => (
                      <Card key={row.id} className="bg-muted/10">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{row.employee}</p>
                              <p className="text-sm">{row.movement}</p>
                              <p className="text-xs text-muted-foreground mt-1">{row.details}</p>
                            </div>
                            <Badge variant="outline">{row.effectiveDate}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right: Create Form */}
          <Card className="xl:sticky xl:top-4 h-fit">
            <CardHeader>
              <CardTitle>New Movement</CardTitle>
              <CardDescription>Record a new employee movement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {renderEmployeeSelector()}
                {renderDatePicker()}
              </div>
              {renderMovementKindSelector()}
              <Separator />
              {renderMovementDetails()}
              <Separator />
              {renderOptionalFields()}
              <Button onClick={onSubmit} disabled={isPending} className="w-full">{isPending ? "Saving..." : "Save Movement"}</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowNone = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; label: string }>
  placeholder: string
  allowNone?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value="__none__">None</SelectItem>}
          {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
