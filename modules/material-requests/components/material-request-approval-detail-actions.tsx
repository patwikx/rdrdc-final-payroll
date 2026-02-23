"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconCheck, IconX } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  approveMaterialRequestStepAction,
  rejectMaterialRequestStepAction,
} from "@/modules/material-requests/actions/material-request-approval-actions"

type MaterialRequestApprovalDetailActionsProps = {
  companyId: string
  requestId: string
  backToQueueHref: string
}

export function MaterialRequestApprovalDetailActions({
  companyId,
  requestId,
  backToQueueHref,
}: MaterialRequestApprovalDetailActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [remarks, setRemarks] = useState("")
  const [isPending, startTransition] = useTransition()

  const submitDecision = (decisionType: "approve" | "reject") => {
    startTransition(async () => {
      const response =
        decisionType === "approve"
          ? await approveMaterialRequestStepAction({
              companyId,
              requestId,
              remarks,
            })
          : await rejectMaterialRequestStepAction({
              companyId,
              requestId,
              remarks,
            })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      setOpen(false)
      router.push(backToQueueHref)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setRemarks("")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="rounded-lg bg-green-600 hover:bg-green-700">
          Take Action
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-border/60 shadow-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Review Material Request</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Submit your approval decision for this request.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-foreground">Decision Remarks (Optional)</Label>
          <Textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Add remarks for your approval or rejection..."
            className="min-h-[96px] rounded-lg text-sm"
          />
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="rounded-lg" disabled={isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-lg"
            disabled={isPending}
            onClick={() => submitDecision("reject")}
          >
            <IconX className="mr-1 h-4 w-4" />
            Reject
          </Button>
          <Button
            type="button"
            className="rounded-lg bg-green-600 hover:bg-green-700"
            disabled={isPending}
            onClick={() => submitDecision("approve")}
          >
            <IconCheck className="mr-1 h-4 w-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
