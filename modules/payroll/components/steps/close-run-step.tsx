"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconAlertTriangle, IconLock } from "@tabler/icons-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { closePayrollRunAction } from "@/modules/payroll/actions/payroll-run-actions"

type CloseRunStepProps = {
  companyId: string
  runId: string
  statusCode: string
  totalEmployees: number
  totalDeductions: number
  totalNetPay: number
}

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "code" })

export function CloseRunStep({ companyId, runId, statusCode, totalEmployees, totalDeductions, totalNetPay }: CloseRunStepProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isLocked, setIsLocked] = useState(statusCode === "PAID")

  const lockMessage = useMemo(() => {
    if (isLocked) {
      return "This pay period is already locked. Payroll records are finalized for this run."
    }
    return "Closing this run finalizes payslips and locks regular pay-period records."
  }, [isLocked])

  const handleClose = () => {
    startTransition(async () => {
      const result = await closePayrollRunAction({ companyId, runId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setConfirmOpen(false)
      setIsLocked(true)
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-card p-4"><p className="text-xs text-muted-foreground">Employees</p><p className="text-lg font-semibold">{totalEmployees}</p></div>
        <div className="rounded-lg border border-border/60 bg-card p-4"><p className="text-xs text-muted-foreground">Total Deductions</p><p className="text-lg font-semibold">{money.format(totalDeductions)}</p></div>
        <div className="rounded-lg border border-border/60 bg-card p-4"><p className="text-xs text-muted-foreground">Total Net Pay</p><p className="text-lg font-semibold text-primary">{money.format(totalNetPay)}</p></div>
      </div>

      <div className="space-y-4 rounded-lg border border-border/60 bg-card p-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span><IconAlertTriangle className="h-5 w-5 text-amber-600" /></span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Critical Action</p>
            <p className="text-xs text-muted-foreground">{lockMessage}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="min-w-44" disabled={isPending || isLocked}>
                <IconLock className="mr-1.5 h-4 w-4" /> {isLocked ? "Period Locked" : "Close Pay Period"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close and lock this pay period?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action finalizes payroll and locks this period from regular updates. Continue only when register review and payslip delivery are complete.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={isPending} onClick={handleClose}>
                  Confirm Close Period
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
