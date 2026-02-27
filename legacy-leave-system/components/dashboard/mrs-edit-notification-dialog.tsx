"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Calendar, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { getMyRequestsMarkedForEdit } from "@/lib/actions/mrs-actions/material-request-actions"

interface MRSEditNotificationDialogProps {
  businessUnitId: string
}

export function MRSEditNotificationDialog({ 
  businessUnitId
}: MRSEditNotificationDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [mrsRequests, setMrsRequests] = useState<Awaited<ReturnType<typeof getMyRequestsMarkedForEdit>>>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadMRSRequests = async () => {
    setIsLoading(true)
    try {
      const mrsData = await getMyRequestsMarkedForEdit(businessUnitId)
      console.log("MRS Edit Notification - Loaded requests for BU:", businessUnitId, "Count:", mrsData.length)
      setMrsRequests(mrsData)
      
      if (mrsData.length > 0) {
        // Check if we've shown the notification in the last 1 minute
        const now = new Date().getTime()
        const lastShownTime = localStorage.getItem(`mrs-edit-notification-time-${businessUnitId}`)
        const oneMinuteAgo = now - (1 * 60 * 1000) // 1 minute
        
        console.log("MRS Edit Notification - Last shown:", lastShownTime, "Should show:", !lastShownTime || parseInt(lastShownTime) < oneMinuteAgo)
        
        if (!lastShownTime || parseInt(lastShownTime) < oneMinuteAgo) {
          setIsOpen(true)
        }
      }
    } catch (error) {
      console.error("Error loading MRS requests marked for edit:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Check if we should show the notification
  useEffect(() => {
    loadMRSRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set up interval to check and show notification every 1 minute
  useEffect(() => {
    if (mrsRequests.length === 0) {
      return
    }

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const lastShownTime = localStorage.getItem(`mrs-edit-notification-time-${businessUnitId}`)
      const oneMinuteAgo = now - (1 * 60 * 1000)
      
      // Show notification if it's been more than 1 minute since last shown
      if (!lastShownTime || parseInt(lastShownTime) < oneMinuteAgo) {
        setIsOpen(true)
      }
    }, 1 * 60 * 1000) // Check every 1 minute

    return () => clearInterval(interval)
  }, [mrsRequests.length, businessUnitId])

  const handleViewRequest = (requestId: string) => {
    setIsOpen(false)
    const now = new Date().getTime()
    localStorage.setItem(`mrs-edit-notification-time-${businessUnitId}`, now.toString())
    router.push(`/${businessUnitId}/material-requests/${requestId}`)
  }

  const handleDismiss = () => {
    setIsOpen(false)
    const now = new Date().getTime()
    localStorage.setItem(`mrs-edit-notification-time-${businessUnitId}`, now.toString())
  }

  if (mrsRequests.length === 0) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-[90vw] lg:max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-xl">Material Requests Need Your Attention</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {mrsRequests.length} material request{mrsRequests.length !== 1 ? 's' : ''} marked for edit by purchaser
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading material requests...</div>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-y-auto max-h-[400px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50 z-10">
                    <TableRow className="border-b hover:bg-transparent">
                      <TableHead className="p-3 w-[120px] font-semibold">MRS No.</TableHead>
                      <TableHead className="p-3 w-[150px] font-semibold">Department</TableHead>
                      <TableHead className="p-3 w-[130px] font-semibold">Marked For Edit</TableHead>
                      <TableHead className="p-3 w-[200px] font-semibold">Reason</TableHead>
                      <TableHead className="p-3 font-semibold">Items to Edit</TableHead>
                      <TableHead className="p-3 w-[80px] font-semibold">Items</TableHead>
                      <TableHead className="p-3 w-[110px] text-right font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mrsRequests.map((mrs) => {
                      // Parse the reason to separate the custom reason from items list
                      const reasonParts = mrs.markedForEditReason?.split('\n\nItems to edit:\n') || []
                      const customReason = reasonParts[0] || 'No reason provided'
                      const itemsList = reasonParts[1] || ''
                      
                      return (
                        <TableRow key={mrs.id} className="border-b hover:bg-muted/30">
                          <TableCell className="p-3">
                            <div className="font-medium font-mono text-sm">{mrs.docNo}</div>
                          </TableCell>
                          <TableCell className="p-3">
                            <span className="text-sm">{mrs.department?.name || 'N/A'}</span>
                          </TableCell>
                          <TableCell className="p-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {mrs.markedForEditAt ? format(new Date(mrs.markedForEditAt), "MMM dd, yyyy") : 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="p-3">
                            <div className="text-sm max-w-[200px]" title={customReason}>
                              {customReason}
                            </div>
                          </TableCell>
                          <TableCell className="p-3">
                            <div className="text-xs whitespace-pre-wrap text-muted-foreground max-w-[300px]">
                              {itemsList || 'All items'}
                            </div>
                          </TableCell>
                          <TableCell className="p-3">
                            <Badge variant="outline" className="text-xs">
                              {mrs.items.length} item{mrs.items.length !== 1 ? 's' : ''}
                            </Badge>
                          </TableCell>
                          <TableCell className="p-3 text-right">
                            <Button 
                              size="sm" 
                              onClick={() => handleViewRequest(mrs.id)}
                              className="gap-2"
                            >
                              <Edit className="h-3 w-3" />
                              Edit Now
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              Please review and update the item descriptions as requested
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
