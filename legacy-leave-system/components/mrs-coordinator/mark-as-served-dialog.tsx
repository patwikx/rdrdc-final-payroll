"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Loader2, CheckCircle, AlertCircle, Building, FileText, Check, ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"
import { markRequestAsServed } from "@/lib/actions/mrs-actions/material-request-actions"
import { MaterialRequest } from "@/types/material-request-types"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface Supplier {
  cardCode: string
  cardName: string
}

interface MarkAsServedDialogProps {
  request: MaterialRequest
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  businessUnitId: string
}

export function MarkAsServedDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
  businessUnitId
}: MarkAsServedDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notes, setNotes] = useState("")
  const [supplierBPCode, setSupplierBPCode] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false)
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("")
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false)
  const [servedQuantities, setServedQuantities] = useState<Record<string, number>>({})

  // Fetch suppliers when popover opens or search term changes
  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!isSupplierPopoverOpen && !supplierSearchTerm) return
      
      setIsLoadingSuppliers(true)
      try {
        const searchParam = supplierSearchTerm ? `?search=${encodeURIComponent(supplierSearchTerm)}` : ""
        const response = await fetch(`/api/suppliers${searchParam}`)
        const data = await response.json()
        
        if (data.success) {
          setSuppliers(data.data)
        } else {
          toast.error("Failed to load suppliers")
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error)
        toast.error("Failed to load suppliers")
      } finally {
        setIsLoadingSuppliers(false)
      }
    }

    const debounceTimer = setTimeout(fetchSuppliers, 300)
    return () => clearTimeout(debounceTimer)
  }, [supplierSearchTerm, isSupplierPopoverOpen])

  const handleSupplierSelect = (supplier: Supplier) => {
    setSupplierBPCode(supplier.cardCode)
    setSupplierName(supplier.cardName)
    setIsSupplierPopoverOpen(false)
    setSupplierSearchTerm("")
  }

  const clearSupplier = () => {
    setSupplierBPCode("")
    setSupplierName("")
  }

  const getSelectedSupplierDisplay = () => {
    if (supplierBPCode && supplierName) {
      return `${supplierBPCode} - ${supplierName}`
    }
    return "Select supplier"
  }

  // Initialize served quantities when dialog opens
  useEffect(() => {
    if (open && request.items) {
      const initialQuantities: Record<string, number> = {}
      request.items.forEach(item => {
        const previouslyServed = typeof item.quantityServed === 'object' && item.quantityServed !== null
          ? item.quantityServed.toNumber()
          : (item.quantityServed || 0)
        const remaining = item.quantity - previouslyServed
        // Default to serving the remaining quantity
        initialQuantities[item.id] = remaining
      })
      setServedQuantities(initialQuantities)
    }
  }, [open, request.items])

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      setServedQuantities(prev => ({
        ...prev,
        [itemId]: numValue
      }))
    }
  }

  const isPartiallyServed = () => {
    return request.items?.some(item => {
      const served = servedQuantities[item.id] || 0
      return served < item.quantity && served > 0
    })
  }

  const hasUnservedItems = () => {
    return request.items?.some(item => {
      const served = servedQuantities[item.id] || 0
      return served === 0
    })
  }

  const validateFields = () => {
    // Validate required fields
    if (!supplierBPCode || supplierBPCode.trim() === "") {
      toast.error("Supplier is required")
      return false
    }

    if (!purchaseOrderNumber || purchaseOrderNumber.trim() === "") {
      toast.error("Purchase Order Number is required")
      return false
    }

    // Validate that at least one item has quantity served
    const hasServedItems = request.items?.some(item => {
      const served = servedQuantities[item.id] || 0
      return served > 0
    })

    if (!hasServedItems) {
      toast.error("Please specify quantity served for at least one item")
      return false
    }

    // Validate quantities don't exceed remaining
    const invalidQuantities = request.items?.filter(item => {
      const previouslyServed = typeof item.quantityServed === 'object' && item.quantityServed !== null
        ? item.quantityServed.toNumber()
        : (item.quantityServed || 0)
      const remaining = item.quantity - previouslyServed
      const servingNow = servedQuantities[item.id] || 0
      return servingNow > remaining
    })

    if (invalidQuantities && invalidQuantities.length > 0) {
      toast.error("Served quantity cannot exceed remaining quantity")
      return false
    }

    return true
  }

  const handlePartiallyServed = async () => {
    if (!validateFields()) return
    
    setIsSubmitting(true)
    
    try {
      const result = await markRequestAsServed({
        requestId: request.id,
        businessUnitId,
        notes: notes.trim() || undefined,
        supplierBPCode: supplierBPCode.trim(),
        supplierName: supplierName.trim(),
        purchaseOrderNumber: purchaseOrderNumber.trim(),
        servedQuantities
      })
      
      if (result.success) {
        toast.success(result.message || "Request partially served successfully")
        onSuccess()
        onOpenChange(false)
        resetForm()
      } else {
        toast.error(result.error || "Failed to mark request as partially served")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMarkAsServed = async () => {
    if (!validateFields()) return

    // Check if all remaining items will be fully served
    const allFullyServed = request.items?.every(item => {
      const previouslyServed = typeof item.quantityServed === 'object' && item.quantityServed !== null
        ? item.quantityServed.toNumber()
        : (item.quantityServed || 0)
      const remaining = item.quantity - previouslyServed
      const servingNow = servedQuantities[item.id] || 0
      return remaining === 0 || servingNow >= remaining
    })

    if (!allFullyServed) {
      toast.error("To mark as fully served, all remaining quantities must be served")
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const result = await markRequestAsServed({
        requestId: request.id,
        businessUnitId,
        notes: notes.trim() || undefined,
        supplierBPCode: supplierBPCode.trim(),
        supplierName: supplierName.trim(),
        purchaseOrderNumber: purchaseOrderNumber.trim(),
        servedQuantities
      })
      
      if (result.success) {
        toast.success(result.message || "Request marked as served successfully")
        onSuccess()
        onOpenChange(false)
        resetForm()
      } else {
        toast.error(result.error || "Failed to mark request as served")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setNotes("")
    setSupplierBPCode("")
    setSupplierName("")
    setPurchaseOrderNumber("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[900px] w-[90vw]">
        <div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Mark Request as Served
            </DialogTitle>
            <DialogDescription>
              Confirm that this material request has been served and is ready for posting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Column - Request Details & Items */}
            <div className="space-y-4">
              {/* Request Details */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 border-b">
                  <h3 className="text-sm font-semibold">Request Information</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Document No</div>
                    <div className="font-mono font-semibold text-lg">{request.docNo}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Requested By</div>
                      <div className="text-sm font-medium">{request.requestedBy.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Department</div>
                      <div className="text-sm font-medium">{request.department?.name || "N/A"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Date Requested</div>
                      <div className="text-sm font-medium">{format(new Date(request.createdAt), "MMM dd, yyyy")}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Total Items</div>
                      <div className="text-sm font-semibold">{request.items?.length || 0} item{(request.items?.length || 0) !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List with Quantity Served */}
              {request.items && request.items.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Items to Serve</Label>
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto text-xs">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-[30px] p-2">#</TableHead>
                          <TableHead className="p-2">Description</TableHead>
                          <TableHead className="text-center w-[55px] p-2">Req.</TableHead>
                          <TableHead className="text-center w-[55px] p-2">Prev.</TableHead>
                          <TableHead className="text-center w-[55px] p-2">Rem.</TableHead>
                          <TableHead className="text-center w-[80px] p-2">Serve</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {request.items.map((item, index) => {
                          const previouslyServed = typeof item.quantityServed === 'object' && item.quantityServed !== null
                            ? item.quantityServed.toNumber()
                            : (item.quantityServed || 0)
                          const remaining = item.quantity - previouslyServed
                          const servingNow = servedQuantities[item.id] || 0
                          const isPartial = servingNow < remaining && servingNow > 0
                          const isOverServed = servingNow > remaining
                          
                          return (
                            <TableRow key={item.id} className={cn("text-xs", previouslyServed > 0 && "bg-muted/30")}>
                              <TableCell className="text-muted-foreground p-2">{index + 1}</TableCell>
                              <TableCell className="p-2">
                                <div className="font-medium">{item.description}</div>
                                <div className="text-[10px] text-muted-foreground">{item.uom}</div>
                                {item.remarks && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.remarks}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-center p-2">
                                <div className="font-semibold">{item.quantity.toString()}</div>
                              </TableCell>
                              <TableCell className="text-center p-2">
                                {previouslyServed > 0 ? (
                                  <div className="font-medium text-green-600 dark:text-green-400">
                                    {previouslyServed}
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground">-</div>
                                )}
                              </TableCell>
                              <TableCell className="text-center p-2">
                                <div className={cn(
                                  "font-semibold",
                                  remaining === 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                                )}>
                                  {remaining.toString()}
                                </div>
                              </TableCell>
                              <TableCell className="p-2">
                                {remaining > 0 ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    max={remaining}
                                    step="0.01"
                                    value={servingNow}
                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                    className={cn(
                                      "h-7 text-center text-xs",
                                      isOverServed && "border-red-500 focus-visible:ring-red-500",
                                      isPartial && "border-amber-500 focus-visible:ring-amber-500"
                                    )}
                                  />
                                ) : (
                                  <div className="text-center text-[10px] text-green-600 dark:text-green-400 font-medium">
                                    Done
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {(isPartiallyServed() || hasUnservedItems()) && (
                    <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
                      <AlertCircle className="h-3 w-3 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-blue-800 dark:text-blue-200">
                        {hasUnservedItems() 
                          ? "Some items have zero quantity to serve. Only items with quantity > 0 will be processed."
                          : "Partial quantities detected. Remaining quantities will stay in 'For Serving' status."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column - Form Fields */}
            <div className="space-y-4">
              {/* Supplier Selection */}
              <div className="space-y-2">
                <Label htmlFor="supplier" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Supplier <span className="text-red-500">*</span>
                </Label>
                <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isSupplierPopoverOpen}
                      className="w-full justify-between"
                    >
                      <span className="truncate">
                        {getSelectedSupplierDisplay()}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search suppliers..." 
                        value={supplierSearchTerm}
                        onValueChange={setSupplierSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {isLoadingSuppliers ? "Loading suppliers..." : "No suppliers found."}
                        </CommandEmpty>
                        <CommandGroup>
                          {supplierBPCode && (
                            <CommandItem
                              onSelect={clearSupplier}
                              className="text-muted-foreground"
                            >
                              <Check className="mr-2 h-4 w-4 opacity-0" />
                              Clear selection
                            </CommandItem>
                          )}
                          {suppliers.map((supplier) => (
                            <CommandItem
                              key={supplier.cardCode}
                              onSelect={() => handleSupplierSelect(supplier)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  supplierBPCode === supplier.cardCode ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">BP Code: {supplier.cardCode}</span>
                                <span className="text-sm text-muted-foreground">
                                  Supplier: {supplier.cardName}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {supplierBPCode && supplierName && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    <div><span className="font-medium">BP Code:</span> {supplierBPCode}</div>
                    <div><span className="font-medium">Supplier:</span> {supplierName}</div>
                  </div>
                )}
              </div>

              {/* Purchase Order Number */}
              <div className="space-y-2">
                <Label htmlFor="purchaseOrderNumber" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Purchase Order Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="purchaseOrderNumber"
                  placeholder="Enter PO number from SAP"
                  value={purchaseOrderNumber}
                  onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter the purchase order number from SAP system.
                </p>
              </div>

              {/* Warning Message */}
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">Important</p>
                  <p className="text-amber-800 dark:text-amber-200">
                    By marking this request as served, it will move to "For Posting" status and will be ready for the next step in the process.
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Notes <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about serving this request..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  These notes will be recorded with the status change.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handlePartiallyServed}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Partially Served
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={handleMarkAsServed}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Served
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}