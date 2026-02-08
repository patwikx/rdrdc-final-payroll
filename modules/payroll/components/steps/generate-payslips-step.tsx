"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconDownload, IconFileDownload, IconFileStack, IconMail, IconPlayerPlayFilled } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { BatchSendPayslipsDialog } from "@/modules/payroll/components/batch-send-payslips-dialog"
import {
  generatePayslipsPayrollRunAction,
  proceedToClosePayrollRunAction,
} from "@/modules/payroll/actions/payroll-run-actions"

type GeneratePayslipsStepProps = {
  companyId: string
  runId: string
  payslipCount: number
  isGenerated: boolean
  payslips: Array<{
    id: string
    employeeName: string
    employeeNumber: string
  }>
}

export function GeneratePayslipsStep({ companyId, runId, payslipCount, isGenerated, payslips }: GeneratePayslipsStepProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const downloadPayslip = (payslipId: string) => {
    const anchor = document.createElement("a")
    anchor.href = `/${companyId}/payroll/payslips/${payslipId}/download`
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generatePayslipsPayrollRunAction({ companyId, runId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const handleProceed = () => {
    startTransition(async () => {
      const result = await proceedToClosePayrollRunAction({ companyId, runId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const handleDownloadAll = () => {
    if (payslips.length === 0) {
      toast.error("No payslips available for download.")
      return
    }

    payslips.forEach((payslip, index) => {
      setTimeout(() => {
        downloadPayslip(payslip.id)
      }, index * 180)
    })

    toast.success(`Started downloading ${payslips.length} payslip PDFs.`)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <div className="space-y-3 rounded-lg border border-border/60 bg-card p-5">
          <p className="text-sm font-medium">Generate Payslips</p>
          <p className="text-xs text-muted-foreground">Create payslip artifacts for this run, then review, download, and send before explicitly proceeding to close.</p>
          <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3 text-xs">
            <p className="flex items-center gap-1.5"><IconFileStack className="h-4 w-4" /> Generated lines are already stored per payslip.</p>
            <p className="flex items-center gap-1.5"><IconFileDownload className="h-4 w-4" /> Export and download flows can be consumed from payslips view.</p>
            <p className="flex items-center gap-1.5"><IconMail className="h-4 w-4" /> Distribution hooks can be added next without changing run lifecycle.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={isPending || !isGenerated}
              onClick={handleDownloadAll}
            >
              <IconFileDownload className="mr-1.5 h-4 w-4" /> Download All Payslips
            </Button>
            <BatchSendPayslipsDialog
              companyId={companyId}
              runId={runId}
              employeeCount={payslipCount}
              disabled={isPending || !isGenerated}
              trigger={
                <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700" disabled={isPending || !isGenerated}>
                  <IconMail className="mr-1.5 h-4 w-4" /> Send Payslips via Email
                </Button>
              }
            />
          </div>

          {isGenerated ? (
            <div className="max-h-56 overflow-y-auto rounded-md border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((payslip) => (
                    <tr key={payslip.id} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <p className="font-medium">{payslip.employeeName}</p>
                        <p className="text-[11px] text-muted-foreground">{payslip.employeeNumber}</p>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => downloadPayslip(payslip.id)}
                        >
                          <IconDownload className="mr-1.5 h-3.5 w-3.5" /> Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="space-y-3 lg:col-span-4">
        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-4 text-sm">
          <p className="font-medium">Status Summary</p>
          <div className="flex items-center justify-between"><span>Total Payslips</span><span>{payslipCount}</span></div>
          <div className="flex items-center justify-between"><span>Generated</span><span>{isGenerated ? "Yes" : "No"}</span></div>
        </div>
        {isGenerated ? (
          <Button type="button" className="w-full" disabled={isPending} onClick={handleProceed}>
            Proceed to Next Step
          </Button>
        ) : (
          <Button type="button" className="w-full" disabled={isPending} onClick={handleGenerate}>
            <IconPlayerPlayFilled className="mr-1.5 h-4 w-4" /> Generate Payslips
          </Button>
        )}
      </aside>
    </div>
  )
}
