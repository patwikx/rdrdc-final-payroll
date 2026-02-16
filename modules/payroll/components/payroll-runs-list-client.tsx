"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { PayrollRunType } from "@prisma/client"
import {
  IconCalendarClock,
  IconChevronRight,
  IconFileText,
  IconFilter,
  IconFolders,
  IconLock,
  IconLoader,
  IconPlus,
  IconProgress,
  IconRosetteDiscountCheck,
  IconSearch,
  IconWallet,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { CreatePayrollRunForm } from "@/modules/payroll/components/create-payroll-run-form"

type NonTrialRunType = Exclude<PayrollRunType, "TRIAL_RUN">

type PayrollRunsListClientProps = {
  companyId: string
  createOptions: {
    payPeriods: Array<{ id: string; label: string }>
    defaultPayPeriodId?: string
    runTypes: Array<{ code: NonTrialRunType; label: string }>
    departments: Array<{ id: string; name: string }>
    branches: Array<{ id: string; name: string }>
    employees: Array<{ id: string; employeeNumber: string; fullName: string }>
  }
  runs: Array<{
    id: string
    runNumber: string
    runTypeCode: string
    runTypeLabel: string
    statusCode: string
    isLocked: boolean
    currentStepNumber: number
    currentStepName: string
    periodLabel: string
    cutoffStartLabel: string
    cutoffEndLabel: string
    periodYear: number
    totalEmployees: number
    totalGrossPay: number
    totalDeductions: number
    totalNetPay: number
    createdAt: string
  }>
}

const stepTitleByName: Record<string, string> = {
  CREATE_RUN: "Setup",
  VALIDATE_DATA: "Validation",
  CALCULATE_PAYROLL: "Calculation",
  REVIEW_ADJUST: "Review",
  GENERATE_PAYSLIPS: "Payslips",
  CLOSE_RUN: "Closing",
}

const amount = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "code" })
const PAGE_SIZE = 10

const getDisplayStatus = (run: PayrollRunsListClientProps["runs"][number]): string => {
  if (run.isLocked && run.statusCode === "PAID") return "LOCKED"
  return run.statusCode
}

const getStatusBadgeClass = (status: string): string => {
  if (status === "LOCKED") return "border-none bg-slate-800 text-white"
  if (["DRAFT", "VALIDATING", "PROCESSING", "FOR_REVIEW"].includes(status)) return "border-none bg-amber-500 text-black"
  if (["APPROVED", "FOR_PAYMENT"].includes(status)) return "border-none bg-blue-600 text-white"
  if (["COMPUTED", "PAID"].includes(status)) return "border-none bg-emerald-600 text-white"
  return "border-border/60"
}

export function PayrollRunsListClient({ companyId, runs, createOptions }: PayrollRunsListClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const statusValues = useMemo(() => Array.from(new Set(runs.map((run) => getDisplayStatus(run)))), [runs])

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesSearch = `${run.runNumber} ${run.runTypeCode} ${run.runTypeLabel}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter ? getDisplayStatus(run) === statusFilter : true
      return matchesSearch && matchesStatus
    })
  }, [runs, searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedRuns = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return filteredRuns.slice(start, start + PAGE_SIZE)
  }, [filteredRuns, safeCurrentPage])

  const statCards = useMemo(() => {
    const activeRuns = runs.filter((run) =>
      ["DRAFT", "VALIDATING", "PROCESSING", "COMPUTED", "FOR_REVIEW", "APPROVED", "FOR_PAYMENT"].includes(getDisplayStatus(run))
    ).length
    const lockedRuns = runs.filter((run) => getDisplayStatus(run) === "LOCKED").length
    const draftRuns = runs.filter((run) => run.statusCode === "DRAFT").length
    const totalNet = runs.reduce((sum, run) => sum + run.totalNetPay, 0)

    return {
      totalRuns: runs.length,
      activeRuns,
      lockedRuns,
      draftRuns,
      totalNet,
    }
  }, [runs])

  return (
    <div className="space-y-4">
      <section className="overflow-hidden border border-border/60 bg-background">
        <div className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-5">
          <div className="bg-background px-3 py-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconFolders className="size-3.5" /> Total Runs
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{statCards.totalRuns}</p>
          </div>
          <div className="bg-background px-3 py-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconLoader className="size-3.5" /> Active Runs
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{statCards.activeRuns}</p>
          </div>
          <div className="bg-background px-3 py-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconFileText className="size-3.5" /> Draft Runs
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{statCards.draftRuns}</p>
          </div>
          <div className="bg-background px-3 py-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconLock className="size-3.5" /> Locked Runs
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{statCards.lockedRuns}</p>
          </div>
          <div className="bg-background px-3 py-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <IconWallet className="size-3.5" /> Aggregate Net
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{amount.format(statCards.totalNet)}</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border border-border/60 bg-background">
        <div className="flex flex-col gap-3 border-b border-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-[280px]">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search run number or type"
                className="h-9 pl-9"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-1.5 text-xs font-medium">
                  <IconFilter className="size-3.5" />
                  {statusFilter ? `Status: ${statusFilter}` : "All statuses"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuCheckboxItem
                  checked={statusFilter === null}
                  onCheckedChange={() => {
                    setStatusFilter(null)
                    setCurrentPage(1)
                  }}
                >
                  All statuses
                </DropdownMenuCheckboxItem>
                {statusValues.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statusFilter === status}
                    onCheckedChange={() => {
                      setStatusFilter(status)
                      setCurrentPage(1)
                    }}
                  >
                    {status}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Badge variant="outline" className="h-9 px-3 text-[11px]">
              {filteredRuns.length} Showing
            </Badge>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 gap-1.5 text-xs font-medium">
                <IconPlus className="size-3.5" /> New Payroll Run
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-[980px]">
              <DialogHeader className="border-b border-border/60 px-5 py-4">
                <DialogTitle>Create Payroll Run</DialogTitle>
                <DialogDescription>Select period, run type, and optional scope filters.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(88vh-92px)] overflow-y-auto px-5 pb-4 pt-2">
                <CreatePayrollRunForm
                  companyId={companyId}
                  payPeriods={createOptions.payPeriods}
                  defaultPayPeriodId={createOptions.defaultPayPeriodId}
                  runTypes={createOptions.runTypes}
                  departments={createOptions.departments}
                  branches={createOptions.branches}
                  employees={createOptions.employees}
                  embedded
                  onSuccess={() => setCreateDialogOpen(false)}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cycle Reference</TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cutoff Window</TableHead>
                <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Workflow Progress</TableHead>
                <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Aggregate Payout</TableHead>
                <TableHead className="h-10 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="h-10 w-[180px] text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-56 text-center">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">No payroll cycles found</p>
                      <p className="text-sm text-muted-foreground">Try changing search/filter or create a new payroll run.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRuns.map((run) => {
                  const progressValue = Math.min((Math.max(run.currentStepNumber, 1) / 6) * 100, 100)
                  const currentStepTitle = stepTitleByName[run.currentStepName] ?? run.currentStepName
                  const displayStatus = getDisplayStatus(run)

                  return (
                    <TableRow key={run.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">{run.runNumber}</p>
                          <p className="text-xs text-muted-foreground">{run.runTypeLabel}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{run.cutoffStartLabel} - {run.cutoffEndLabel}</p>
                        <p className="text-xs text-muted-foreground">{run.periodYear} fiscal</p>
                      </TableCell>
                      <TableCell className="min-w-[240px]">
                        <div className="max-w-[220px] space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="inline-flex items-center gap-1 text-primary">
                              <IconProgress className="size-3.5" /> {currentStepTitle}
                            </span>
                            <span className="text-muted-foreground">Step {Math.min(run.currentStepNumber, 6)}/6</span>
                          </div>
                          <Progress value={progressValue} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-foreground">{amount.format(run.totalNetPay)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("inline-flex h-6 items-center gap-1.5 px-2 text-[10px] font-medium uppercase tracking-wide", getStatusBadgeClass(displayStatus))}>
                          {displayStatus === "LOCKED" ? <IconLock className="size-3.5" /> : <IconRosetteDiscountCheck className="size-3.5" />}
                          {displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button asChild size="sm" className="h-7 gap-1 text-xs font-medium">
                            <Link href={`/${companyId}/payroll/runs/${run.id}`}>
                              Process <IconChevronRight className="size-3.5" />
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs font-medium">
                            <Link href={`/${companyId}/payroll/runs/${run.id}`}>
                              <IconCalendarClock className="size-3.5" /> View
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredRuns.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Page {safeCurrentPage} of {totalPages} - {filteredRuns.length} runs
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
              >
                Prev
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
