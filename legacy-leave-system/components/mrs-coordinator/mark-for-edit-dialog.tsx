"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { MaterialRequest } from "@/types/material-request-types"
import { markRequestForEdit } from "@/lib/actions/mrs-actions/material-request-actions"

interface MarkForEditDialogProps {
  request: MaterialRequest
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface FormData {
  reason: string
}

export function MarkForEditDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
}: MarkForEditDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const form = useForm<FormData>({
    defaultValues: {
      reason: "",
    },
  })

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const toggleAll = () => {
    if (selectedItems.length === request.items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(request.items.map(item => item.id))
    }
  }

  const onSubmit = async (data: FormData) => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to mark for edit")
      return
    }

    setIsLoading(true)
    try {
      // Build reason with selected items info
      const selectedItemsInfo = request.items
        .filter(item => selectedItems.includes(item.id))
        .map((item, idx) => `${idx + 1}. ${item.description}`)
        .join('\n')
      
      const fullReason = data.reason 
        ? `${data.reason}\n\nItems to edit:\n${selectedItemsInfo}`
        : `Items to edit:\n${selectedItemsInfo}`

      const result = await markRequestForEdit({
        requestId: request.id,
        reason: fullReason,
      })

      if (result.success) {
        toast.success("Request marked for edit successfully")
        form.reset()
        setSelectedItems([])
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error marking request for edit:", error)
      toast.error("Failed to mark request for edit")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Mark Request for Edit</DialogTitle>
              <DialogDescription>
                Request {request.docNo} will be marked for the requestor to edit item descriptions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Document No:</span>
                    <span className="font-medium font-mono">{request.docNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested By:</span>
                    <span className="font-medium">{request.requestedBy.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{request.department?.name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span className="font-medium">{request.items.length} item{request.items.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-lg border bg-muted/30">
                <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                  <div className="text-sm font-semibold">Select items to be edited:</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    className="h-8 text-xs"
                  >
                    {selectedItems.length === request.items.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedItems.length === request.items.length && request.items.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24">Item Code</TableHead>
                        <TableHead className="w-20">UOM</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {request.items.map((item, index) => (
                        <TableRow 
                          key={item.id}
                          className={selectedItems.includes(item.id) ? "bg-primary/5" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.includes(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="max-w-[300px]">
                              <div className="font-medium">{item.description}</div>
                              {item.remarks && (
                                <div className="text-xs text-muted-foreground mt-1 italic">
                                  {item.remarks}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.itemCode || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-xs">{item.uom}</TableCell>
                          <TableCell className="text-xs">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-2 border-t bg-muted/50 text-xs text-muted-foreground">
                  {selectedItems.length} of {request.items.length} item{request.items.length !== 1 ? 's' : ''} selected
                </div>
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional notes or instructions for the requestor..."
                        className="resize-none min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-destructive">What happens next?</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>The requestor will be notified on their next login</li>
                      <li>They can edit item descriptions only</li>
                      <li>The request status will remain unchanged</li>
                      <li>You'll be notified when they complete the edit</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isLoading}>
                {isLoading ? "Marking..." : "Mark for Edit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
