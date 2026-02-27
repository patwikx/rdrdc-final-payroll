"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { markAsPosted } from "@/lib/actions/mrs-actions/material-request-actions"
import { MaterialRequest } from "@/types/material-request-types"

interface MarkAsPostedDialogProps {
  request: MaterialRequest
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function MarkAsPostedDialog({ 
  request, 
  isOpen, 
  onOpenChange, 
  onSuccess 
}: MarkAsPostedDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const result = await markAsPosted(request.id)

      if (result.success) {
        toast.success(result.message)
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error marking as posted:", error)
      toast.error("Failed to mark request as posted")
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
            Mark Request as Posted
          </DialogTitle>
          <DialogDescription>
            Mark material request &quot;{request.docNo}&quot; as posted.
          </DialogDescription>
        </DialogHeader>

        {/* Request Summary */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 border-b">
            <h3 className="text-sm font-semibold">Request Summary</h3>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground mb-1">Request No</div>
                <div className="font-mono font-semibold">{request.docNo}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Type</div>
                <Badge variant="outline" className="text-xs">{request.type}</Badge>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Items</div>
                <div className="font-medium">{request.items.length} {request.items.length === 1 ? 'item' : 'items'}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Requested By</div>
                <div className="font-medium truncate">{request.requestedBy.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Department</div>
                <div className="font-medium truncate">{request.department?.name || "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Total Amount</div>
                <div className="font-semibold">₱{request.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* Supplier and PO Information */}
            {(request.supplierBPCode || request.supplierName || request.purchaseOrderNumber) && (
              <div className="pt-3 border-t">
                <div className="text-xs text-muted-foreground mb-2">Supplier & Purchase Order</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {request.supplierBPCode && (
                    <div>
                      <div className="text-muted-foreground mb-1">BP Code</div>
                      <div className="font-mono font-medium">{request.supplierBPCode}</div>
                    </div>
                  )}
                  {request.supplierName && (
                    <div>
                      <div className="text-muted-foreground mb-1">Supplier</div>
                      <div className="font-medium truncate" title={request.supplierName}>{request.supplierName}</div>
                    </div>
                  )}
                  {request.purchaseOrderNumber && (
                    <div>
                      <div className="text-muted-foreground mb-1">PO Number</div>
                      <div className="font-mono font-medium">{request.purchaseOrderNumber}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                Mark as Posted
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
