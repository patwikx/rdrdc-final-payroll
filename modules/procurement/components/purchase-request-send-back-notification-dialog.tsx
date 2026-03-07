"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { IconArrowRight, IconRotateClockwise2 } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { acknowledgePurchaseRequestSendBackNoticeAction } from "@/modules/procurement/actions/purchase-request-actions"

type PurchaseRequestSendBackNotice = {
  id: string
  requestNumber: string
  sentBackAtLabel: string | null
  sentBackReason: string | null
}

type PurchaseRequestSendBackNotificationDialogProps = {
  companyId: string
  request: PurchaseRequestSendBackNotice | null
}

export function PurchaseRequestSendBackNotificationDialog({
  companyId,
  request,
}: PurchaseRequestSendBackNotificationDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(Boolean(request))

  if (!request) {
    return null
  }

  const acknowledgeNotice = () => {
    startTransition(async () => {
      const result = await acknowledgePurchaseRequestSendBackNoticeAction({
        companyId,
        requestId: request.id,
      })

      if (!result.ok) {
        toast.error(result.error ?? "Failed to acknowledge notice.")
        return
      }

      toast.success(result.message ?? "Send-back notice acknowledged.")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-2xl border-border/60 shadow-none sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 pb-3">
          <DialogTitle className="text-base font-semibold">Purchase Request Sent Back</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Request <span className="font-medium text-foreground">{request.requestNumber}</span> was sent back for editing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-1">
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="mt-1 text-sm text-foreground">{request.sentBackReason ?? "-"}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Sent Back At</p>
            <p className="mt-1 text-sm text-foreground">{request.sentBackAtLabel ?? "-"}</p>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => setOpen(false)}>
            Later
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="rounded-lg" asChild>
              <Link href={`/${companyId}/employee-portal/purchase-requests/${request.id}`} onClick={() => setOpen(false)}>
                Open Request
                <IconArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button type="button" className="rounded-lg" onClick={acknowledgeNotice} disabled={isPending}>
              <IconRotateClockwise2 className="mr-1.5 h-4 w-4" />
              Acknowledge
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
