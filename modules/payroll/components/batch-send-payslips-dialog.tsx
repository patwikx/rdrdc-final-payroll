"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconAlertTriangle, IconCheck, IconLoader2, IconMail, IconRefresh, IconX } from "@tabler/icons-react"
import { toast } from "sonner"

import {
  resendPayrollPayslipEmailAction,
  sendPayrollRunPayslipEmailsAction,
} from "@/modules/payroll/actions/payslip-distribution-actions"

type BatchSendPayslipsDialogProps = {
  companyId: string
  runId: string
  employeeCount: number
  disabled?: boolean
  trigger?: React.ReactNode
}

type FailedEmail = {
  payslipId: string
  employeeName: string
  email: string
  reason: string
  retryCount: number
}

type BatchResult = {
  totalSent: number
  totalFailed: number
  failedEmails: FailedEmail[]
}

export function BatchSendPayslipsDialog({ companyId, runId, employeeCount, disabled = false, trigger }: BatchSendPayslipsDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [retryingEmails, setRetryingEmails] = useState<Map<string, boolean>>(new Map())

  const isRetrying = (payslipId: string): boolean => retryingEmails.get(payslipId) ?? false

  const handleSendBatch = async () => {
    setIsSending(true)
    setProgress(0)
    setResult(null)

    const progressTimer = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 90))
    }, 450)

    try {
      const batchResult = await sendPayrollRunPayslipEmailsAction({ companyId, runId })
      clearInterval(progressTimer)
      setProgress(100)

      if (!batchResult.ok) {
        toast.error(batchResult.error)
        setOpen(false)
        return
      }

      const nextResult: BatchResult = {
        totalSent: batchResult.sentCount,
        totalFailed: batchResult.failedCount + batchResult.skippedCount,
        failedEmails: batchResult.failures,
      }
      setResult(nextResult)

      if (nextResult.totalFailed === 0) {
        toast.success(`Successfully sent ${nextResult.totalSent} emails.`)
      } else {
        toast.warning(`Sent: ${nextResult.totalSent}, Failed/Skipped: ${nextResult.totalFailed}`)
      }
    } catch {
      clearInterval(progressTimer)
      toast.error("Batch send failed unexpectedly.")
      setOpen(false)
    } finally {
      setIsSending(false)
    }
  }

  const handleRetryFailed = async (failedEmail: FailedEmail) => {
    if (failedEmail.retryCount >= 3) {
      toast.error("Maximum retries reached for this email.")
      return
    }

    setRetryingEmails((prev) => new Map(prev).set(failedEmail.payslipId, true))

    try {
      const retryResult = await resendPayrollPayslipEmailAction({ companyId, payslipId: failedEmail.payslipId })

      if (!retryResult.ok) {
        setResult((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            failedEmails: prev.failedEmails.map((email) =>
              email.payslipId === failedEmail.payslipId
                ? { ...email, reason: retryResult.error, retryCount: email.retryCount + 1 }
                : email
            ),
          }
        })
        toast.error(retryResult.error)
        return
      }

      setResult((prev) => {
        if (!prev) return prev
        return {
          totalSent: prev.totalSent + 1,
          totalFailed: Math.max(prev.totalFailed - 1, 0),
          failedEmails: prev.failedEmails.filter((email) => email.payslipId !== failedEmail.payslipId),
        }
      })

      toast.success("Retry successful.")
    } finally {
      setRetryingEmails((prev) => {
        const next = new Map(prev)
        next.delete(failedEmail.payslipId)
        return next
      })
    }
  }

  const handleClose = () => {
    if (isSending) return
    setOpen(false)
    setResult(null)
    setProgress(0)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" disabled={disabled}>
            <IconMail className="mr-1.5 h-4 w-4" /> Send Payslips via Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Batch Email Send</DialogTitle>
          <DialogDescription>
            {!result ? `Send payslip emails to ${employeeCount} employees.` : "Batch send results."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isSending && !result ? (
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4">
              <IconAlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Confirmation Required</p>
                <p className="text-xs text-muted-foreground">This will send payslip emails for this run and write delivery logs.</p>
              </div>
            </div>
          ) : null}

          {isSending ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <IconLoader2 className="h-4 w-4 animate-spin" /> Sending emails...
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-xs text-emerald-700">Successful</p>
                  <p className="text-2xl font-semibold text-emerald-700">{result.totalSent}</p>
                </div>
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3">
                  <p className="text-xs text-rose-700">Failed / Skipped</p>
                  <p className="text-2xl font-semibold text-rose-700">{result.totalFailed}</p>
                </div>
              </div>

              {result.failedEmails.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Failed Emails ({result.failedEmails.length})</p>
                  <ScrollArea className="h-[220px] rounded-md border border-border/60">
                    <div className="space-y-2 p-2">
                      {result.failedEmails.map((failedEmail) => (
                        <div key={failedEmail.payslipId} className="rounded-md border border-border/60 bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 text-xs">
                              <p className="font-semibold">{failedEmail.employeeName}</p>
                              <p className="truncate text-muted-foreground">{failedEmail.email || "No active email"}</p>
                              <p className="mt-1 text-rose-700">{failedEmail.reason}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isRetrying(failedEmail.payslipId) || failedEmail.retryCount >= 3}
                              onClick={() => handleRetryFailed(failedEmail)}
                            >
                              {isRetrying(failedEmail.payslipId) ? (
                                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <><IconRefresh className="mr-1 h-3.5 w-3.5" /> Retry</>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSending}>
                <IconX className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
              <Button type="button" onClick={handleSendBatch} disabled={isSending}>
                {isSending ? <IconLoader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <IconMail className="mr-1.5 h-4 w-4" />}
                Send {employeeCount} Emails
              </Button>
            </>
          ) : (
            <Button type="button" onClick={handleClose}>
              <IconCheck className="mr-1.5 h-4 w-4" /> Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
