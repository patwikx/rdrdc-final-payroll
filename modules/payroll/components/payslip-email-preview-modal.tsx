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
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconEye, IconLoader2, IconMail } from "@tabler/icons-react"
import { toast } from "sonner"

import {
  previewPayrollPayslipEmailAction,
  resendPayrollPayslipEmailAction,
} from "@/modules/payroll/actions/payslip-distribution-actions"

type PayslipEmailPreviewModalProps = {
  companyId: string
  payslipId: string
  disabled?: boolean
}

export function PayslipEmailPreviewModal({ companyId, payslipId, disabled = false }: PayslipEmailPreviewModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [preview, setPreview] = useState<{
    recipientEmail: string
    employeeName: string
    subject: string
    html: string
    plainText: string
  } | null>(null)

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen || preview) return

    setIsLoading(true)
    const result = await previewPayrollPayslipEmailAction({ companyId, payslipId })
    setIsLoading(false)

    if (!result.ok) {
      toast.error(result.error)
      setOpen(false)
      return
    }

    setPreview(result.data)
  }

  const handleSend = async () => {
    setIsSending(true)
    const result = await resendPayrollPayslipEmailAction({ companyId, payslipId })
    setIsSending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(result.message)
    setOpen(false)
    setPreview(null)
  }

  const handleClose = () => {
    if (isSending) return
    setOpen(false)
    setPreview(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          <IconEye className="mr-1.5 h-3.5 w-3.5" /> Preview Email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>Email Preview</DialogTitle>
          <DialogDescription>Review the payslip email content before sending.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview...
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
              <p><span className="font-semibold">To:</span> {preview.recipientEmail}</p>
              <p><span className="font-semibold">Subject:</span> {preview.subject}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ScrollArea className="h-[340px] rounded-md border border-border/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">HTML Preview</p>
                <iframe
                  title="Payslip email HTML preview"
                  srcDoc={preview.html}
                  sandbox=""
                  className="h-[280px] w-full rounded border border-border/40 bg-white"
                />
              </ScrollArea>
              <ScrollArea className="h-[340px] rounded-md border border-border/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plain Text</p>
                <pre className="whitespace-pre-wrap text-xs">{preview.plainText}</pre>
              </ScrollArea>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSending}>
            Close
          </Button>
          <Button type="button" onClick={handleSend} disabled={isSending || isLoading || !preview}>
            {isSending ? <IconLoader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <IconMail className="mr-1.5 h-4 w-4" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
