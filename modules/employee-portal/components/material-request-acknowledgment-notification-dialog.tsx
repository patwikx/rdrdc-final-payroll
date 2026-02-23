"use client"

import Link from "next/link"
import { useState } from "react"
import { IconArrowRight, IconClipboardCheck } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type PendingAcknowledgmentItem = {
  id: string
  requestNumber: string
  processingCompletedAtLabel: string | null
}

type MaterialRequestAcknowledgmentNotificationDialogProps = {
  companyId: string
  requests: PendingAcknowledgmentItem[]
}

export function MaterialRequestAcknowledgmentNotificationDialog({
  companyId,
  requests,
}: MaterialRequestAcknowledgmentNotificationDialogProps) {
  const [open, setOpen] = useState(requests.length > 0)

  if (requests.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl border-border/60 shadow-none sm:max-w-xl">
        <DialogHeader className="border-b border-border/60 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <IconClipboardCheck className="h-4 w-4 text-primary" />
            Acknowledge Served Materials
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {requests.length === 1
              ? "You have 1 processed request waiting for receipt acknowledgment."
              : `You have ${requests.length} processed requests waiting for receipt acknowledgment.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/${companyId}/employee-portal/material-requests/${request.id}`}
              onClick={() => setOpen(false)}
              className="group flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{request.requestNumber}</p>
                <p className="text-xs text-muted-foreground">
                  Completed: {request.processingCompletedAtLabel ?? "-"}
                </p>
              </div>
              <IconArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </Link>
          ))}
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => setOpen(false)}>
            Dismiss
          </Button>
          <Button asChild className="rounded-lg">
            <Link href={`/${companyId}/employee-portal/material-requests`} onClick={() => setOpen(false)}>
              Open Material Requests
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
