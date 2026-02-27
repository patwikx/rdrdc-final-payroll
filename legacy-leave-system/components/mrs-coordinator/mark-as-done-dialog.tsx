"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { markAsReceived } from "@/lib/actions/mrs-actions/material-request-actions"
import { MaterialRequest } from "@/types/material-request-types"

interface MarkAsDoneDialogProps {
  request: MaterialRequest
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function MarkAsDoneDialog({ 
  request, 
  isOpen, 
  onOpenChange, 
  onSuccess 
}: MarkAsDoneDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const result = await markAsReceived(request.id)

      if (result.success) {
        toast.success(result.message)
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error marking as done:", error)
      toast.error("Failed to mark request as done")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Mark Request as Done
          </DialogTitle>
          <DialogDescription>
            Mark material request &quot;{request.docNo}&quot; as completed and received.
          </DialogDescription>
        </DialogHeader>

        {/* Request Summary */}
        <div className="space-y-3 py-3 border-y">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium">Request No:</span>
              <div className="text-muted-foreground">{request.docNo}</div>
            </div>
            <div>
              <span className="font-medium">Type:</span>
              <div className="text-muted-foreground">
                <Badge variant="outline">{request.type}</Badge>
              </div>
            </div>
            <div>
              <span className="font-medium">Requested By:</span>
              <div className="text-muted-foreground">
                {request.requestedBy.name} 
              </div>
            </div>
            <div>
              <span className="font-medium">Department:</span>
              <div className="text-muted-foreground">
                {request.department?.name || "No Department"}
              </div>
            </div>
            <div>
              <span className="font-medium">Total Amount:</span>
              <div className="text-muted-foreground font-medium">
                ₱{request.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Requested Items</h4>
          <div className="border rounded-md overflow-hidden">
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Item Code</th>
                    <th className="text-left p-2 font-medium">Description</th>
                    <th className="text-center p-2 font-medium">UOM</th>
                    <th className="text-right p-2 font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                      <td className="p-2">{item.itemCode || "-"}</td>
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-center">{item.uom}</td>
                      <td className="p-2 text-right">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Total: {request.items.length} {request.items.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </>
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Mark as Done
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}