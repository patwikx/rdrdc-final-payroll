"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { PayrollRunType } from "@prisma/client"
import {
  IconChevronRight,
  IconDots,
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
  DropdownMenuItem,
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
import { CreatePayrollRunForm } from "@/modules/payroll/components/create-payroll-run-form"

type PayrollRunsListClientProps = {
  companyId: string
  createOptions: {
    payPeriods: Array<{ id: string; label: string }>
    defaultPayPeriodId?: string
    runTypes: Array<{ code: PayrollRunType; label: string }>
    departments: Array<{ id: string; name: string }>
    branches: Array<{ id: string; name: string }>
  }
  runs: Array<{
    id: string
    runNumber: string
    runTypeCode: string
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

const getDisplayStatus = (run: PayrollRunsListClientProps["runs"][number]): string => {
  if (run.isLocked && run.statusCode === "PAID") return "LOCKED"
  return run.statusCode
}

export function PayrollRunsListClient({ companyId, runs, createOptions }: PayrollRunsListClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const statusValues = useMemo(() => Array.from(new Set(runs.map((run) => getDisplayStatus(run)))), [runs])

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesSearch = `${run.runNumber} ${run.runTypeCode}`.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter ? getDisplayStatus(run) === statusFilter : true
      return matchesSearch && matchesStatus
    })
  }, [runs, searchTerm, statusFilter])

  const statCards = useMemo(() => {
    const activeRuns = runs.filter((run) => ["DRAFT", "VALIDATING", "PROCESSING", "COMPUTED", "FOR_REVIEW", "APPROVED", "FOR_PAYMENT"].includes(getDisplayStatus(run))).length
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
      <div className="overflow-hidden border border-border/60">
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 sm:divide-x sm:divide-border/60">
          <div className="border-b border-border/60 p-3 sm:border-b-0">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
            <IconFolders className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">Total Runs</p>
          <p className="text-lg font-semibold text-foreground">{statCards.totalRuns}</p>
          </div>
          <div className="border-b border-border/60 p-3 sm:border-b-0">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IconLoader className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">Active Runs</p>
          <p className="text-lg font-semibold text-foreground">{statCards.activeRuns}</p>
          </div>
          <div className="border-b border-border/60 p-3 sm:border-b-0">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
            <IconFileText className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">Draft Runs</p>
          <p className="text-lg font-semibold text-foreground">{statCards.draftRuns}</p>
          </div>
          <div className="border-b border-border/60 p-3 sm:border-b-0">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
            <IconLock className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">Locked Runs</p>
          <p className="text-lg font-semibold text-foreground">{statCards.lockedRuns}</p>
          </div>
          <div className="p-3">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
            <IconWallet className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">Aggregate Net</p>
          <p className="text-lg font-semibold text-foreground">{amount.format(statCards.totalNet)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-b border-border/60 pb-4 sm:flex-row">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-80">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search run number or type..."
              className="w-full pl-9"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
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
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <IconPlus className="mr-1.5 h-4 w-4" /> New Payroll Run
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[840px]">
            <DialogHeader>
              <DialogTitle>Create Payroll Run</DialogTitle>
              <DialogDescription>Select period, run type, and optional scope filters.</DialogDescription>
            </DialogHeader>
            <CreatePayrollRunForm
              companyId={companyId}
              payPeriods={createOptions.payPeriods}
              defaultPayPeriodId={createOptions.defaultPayPeriodId}
              runTypes={createOptions.runTypes}
              departments={createOptions.departments}
              branches={createOptions.branches}
              embedded
              onSuccess={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden border border-border/60 bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead>Cycle Reference</TableHead>
              <TableHead>Cutoff Window</TableHead>
              <TableHead>Workflow Progress</TableHead>
              <TableHead className="text-right">Aggregate Payout</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[96px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRuns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-52 text-center text-muted-foreground">
                  No payroll cycles found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRuns.map((run) => {
                const progressValue = Math.min((Math.max(run.currentStepNumber, 1) / 6) * 100, 100)
                const currentStepTitle = stepTitleByName[run.currentStepName] ?? run.currentStepName
                const displayStatus = getDisplayStatus(run)
                return (
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-primary">
                          <IconFileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{run.runNumber}</p>
                          <p className="text-[11px] text-muted-foreground">{run.runTypeCode}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{run.cutoffStartLabel} - {run.cutoffEndLabel}</p>
                      <p className="text-[11px] text-muted-foreground">{run.periodYear} fiscal</p>
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="max-w-[190px] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="inline-flex items-center gap-1 text-primary"><IconProgress className="h-3.5 w-3.5" /> {currentStepTitle}</span>
                          <span className="text-muted-foreground">Step {Math.min(run.currentStepNumber, 6)}/6</span>
                        </div>
                        <Progress value={progressValue} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{amount.format(run.totalNetPay)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="inline-flex items-center gap-1.5">
                        {displayStatus === "LOCKED" ? <IconLock className="h-3.5 w-3.5" /> : <IconRosetteDiscountCheck className="h-3.5 w-3.5" />}
                        {displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/${companyId}/payroll/runs/${run.id}`}>
                            Process <IconChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <IconDots className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/${companyId}/payroll/runs/${run.id}`}>View Summary</Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
