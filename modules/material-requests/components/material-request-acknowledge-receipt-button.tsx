"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconClipboardCheck } from "@tabler/icons-react"
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
import { acknowledgeMaterialRequestReceiptAction } from "@/modules/material-requests/actions/material-request-actions"

type MaterialRequestAcknowledgeReceiptButtonProps = {
  companyId: string
  requestId: string
  requestNumber: string
  requestDetailsHref?: string
  disabled?: boolean
}

export function MaterialRequestAcknowledgeReceiptButton({
  companyId,
  requestId,
  requestNumber,
  requestDetailsHref,
  disabled = false,
}: MaterialRequestAcknowledgeReceiptButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" className="rounded-lg" disabled={disabled}>
          <IconClipboardCheck className="mr-1 h-4 w-4" />
          Acknowledge Receipt
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-xl border-border/60 shadow-none">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm received items?</AlertDialogTitle>
          <AlertDialogDescription>
            This confirms that all served items for request #{requestNumber} were received. A receiving report will be
            generated and saved.
          </AlertDialogDescription>
          {requestDetailsHref ? (
            <AlertDialogDescription>
              If you need to review lines, quantities, or remarks first, open the request details before confirming.
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {requestDetailsHref ? (
            <Button type="button" variant="outline" asChild>
              <Link href={requestDetailsHref}>Review Request Details</Link>
            </Button>
          ) : null}
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()

              startTransition(async () => {
                const result = await acknowledgeMaterialRequestReceiptAction({
                  companyId,
                  requestId,
                })

                if (!result.ok) {
                  toast.error(result.error)
                  return
                }

                toast.success(result.message)
                setIsOpen(false)

                if (result.receivingReportId) {
                  router.push(
                    `/${companyId}/employee-portal/material-request-receiving-reports/${result.receivingReportId}`
                  )
                  return
                }

                router.refresh()
              })
            }}
          >
            {isPending ? "Saving..." : "Confirm Receipt"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
