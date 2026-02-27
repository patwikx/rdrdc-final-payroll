"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface MRSItem {
  itemId: string;
  itemCode: string;
  itemDesc: string;
  buyUnitMsr: string | null;
  purPackMsr: string | null;
  cost: number;
}

interface SelectedItem extends MRSItem {
  quantity: number;
  unitPrice: number;
  remarks?: string;
}

interface MaterialRequestItem {
  itemCode?: string;
  description: string;
  uom: string;
  quantity: number;
  unitPrice?: number;
  remarks?: string;
  isNew: boolean;
}

interface MultiSelectItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsSelected: (items: MaterialRequestItem[]) => void;
}

export function MultiSelectItemsDialog({ 
  open, 
  onOpenChange, 
  onItemsSelected 
}: MultiSelectItemsDialogProps) {
  const [items, setItems] = useState<MRSItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map())
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 50

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1) // Reset to first page on search
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch items from API with search and pagination
  useEffect(() => {
    if (open) {
      fetchItems()
    }
  }, [open, debouncedSearchTerm, currentPage])

  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim())
      }
      params.append('page', currentPage.toString())
      params.append('limit', itemsPerPage.toString())

      const response = await fetch(`/api/mrs-items?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setItems(data.data)
        setTotalItems(data.total || data.data.length)
      } else {
        toast.error("Failed to fetch items")
      }
    } catch (error) {
      console.error("Error fetching items:", error)
      toast.error("Failed to fetch items")
    } finally {
      setIsLoading(false)
    }
  }

  const handleItemToggle = useCallback((item: MRSItem, checked?: boolean) => {
    const newSelectedItems = new Map(selectedItems)
    const isCurrentlySelected = selectedItems.has(item.itemId)
    const shouldSelect = checked !== undefined ? checked : !isCurrentlySelected
    
    if (shouldSelect) {
      // Add item with default values
      newSelectedItems.set(item.itemId, {
        ...item,
        quantity: 1,
        unitPrice: item.cost || 0,
        remarks: ""
      })
    } else {
      // Remove item
      newSelectedItems.delete(item.itemId)
    }
    
    setSelectedItems(newSelectedItems)
  }, [selectedItems])

  const handleRowClick = useCallback((item: MRSItem, event: React.MouseEvent) => {
    // Don't toggle if clicking on input fields or checkbox
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.closest('input') || target.closest('[role="checkbox"]')) {
      return
    }
    
    handleItemToggle(item)
  }, [handleItemToggle])

  const handleQuantityChange = (itemId: string, quantity: number) => {
    const newSelectedItems = new Map(selectedItems)
    const item = newSelectedItems.get(itemId)
    
    if (item && quantity > 0) {
      newSelectedItems.set(itemId, { ...item, quantity })
      setSelectedItems(newSelectedItems)
    }
  }

  const handleUnitPriceChange = (itemId: string, unitPrice: number) => {
    const newSelectedItems = new Map(selectedItems)
    const item = newSelectedItems.get(itemId)
    
    if (item && unitPrice >= 0) {
      newSelectedItems.set(itemId, { ...item, unitPrice })
      setSelectedItems(newSelectedItems)
    }
  }

  const handleRemarksChange = (itemId: string, remarks: string) => {
    const newSelectedItems = new Map(selectedItems)
    const item = newSelectedItems.get(itemId)
    
    if (item) {
      newSelectedItems.set(itemId, { ...item, remarks })
      setSelectedItems(newSelectedItems)
    }
  }

  const handleAddSelectedItems = () => {
    const itemsToAdd: MaterialRequestItem[] = Array.from(selectedItems.values()).map(item => ({
      itemCode: item.itemCode,
      description: item.itemDesc,
      uom: item.buyUnitMsr || item.purPackMsr || "pcs",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      remarks: item.remarks,
      isNew: false
    }))

    onItemsSelected(itemsToAdd)
    
    // Reset state
    setSelectedItems(new Map())
    setSearchTerm("")
    onOpenChange(false)
    
    toast.success(`${itemsToAdd.length} item(s) added successfully`)
  }

  const handleCancel = () => {
    setSelectedItems(new Map())
    setSearchTerm("")
    setDebouncedSearchTerm("")
    setCurrentPage(1)
    onOpenChange(false)
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] !w-[95vw] md:!max-w-[45vw] md:!w-[45vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Existing Items</DialogTitle>
        </DialogHeader>

        {/* Search and Pagination Info */}
        <div className="flex items-center space-x-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by item code or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="whitespace-nowrap">
              {selectedItems.size} selected
            </Badge>
            {totalItems > 0 && (
              <Badge variant="outline" className="whitespace-nowrap text-xs">
                {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
              </Badge>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 min-h-0">
          <div className="h-[60vh] w-full border rounded-md overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Loading items...</div>
              </div>
            ) : (
              <div className="w-full h-full overflow-auto">
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <div className="min-w-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-20 border-b shadow-sm">
                        <TableRow className="h-10">
                          <TableHead className="w-8 px-1 text-xs">
                            <Checkbox
                              checked={items.length > 0 && items.every(item => selectedItems.has(item.itemId))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const newSelectedItems = new Map(selectedItems)
                                  items.forEach(item => {
                                    if (!newSelectedItems.has(item.itemId)) {
                                      newSelectedItems.set(item.itemId, {
                                        ...item,
                                        quantity: 1,
                                        unitPrice: item.cost || 0,
                                        remarks: ""
                                      })
                                    }
                                  })
                                  setSelectedItems(newSelectedItems)
                                } else {
                                  const newSelectedItems = new Map(selectedItems)
                                  items.forEach(item => {
                                    newSelectedItems.delete(item.itemId)
                                  })
                                  setSelectedItems(newSelectedItems)
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="w-24 px-1 text-xs">Code</TableHead>
                          <TableHead className="min-w-0 px-1 text-xs">Description</TableHead>
                          <TableHead className="w-12 px-1 text-xs">UOM</TableHead>
                          <TableHead className="w-16 px-1 text-xs">Cost</TableHead>
                          <TableHead className="w-12 px-1 text-xs">Qty</TableHead>
                          <TableHead className="w-20 px-1 text-xs">Price</TableHead>
                          <TableHead className="w-20 px-1 text-xs">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => {
                          const isSelected = selectedItems.has(item.itemId)
                          const selectedItem = selectedItems.get(item.itemId)
                          
                          return (
                            <TableRow 
                              key={item.itemId} 
                              className={`h-10 cursor-pointer hover:bg-muted/30 ${isSelected ? "bg-muted/50" : ""}`}
                              onClick={(e) => handleRowClick(item, e)}
                            >
                              <TableCell className="px-1 py-1">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleItemToggle(item, checked as boolean)}
                                />
                              </TableCell>
                              <TableCell className="font-medium px-1 py-1 text-xs">
                                <div className="truncate" title={item.itemCode}>
                                  {item.itemCode}
                                </div>
                              </TableCell>
                              <TableCell className="px-1 py-1 text-xs">
                                <div className="truncate" title={item.itemDesc}>
                                  {item.itemDesc}
                                </div>
                              </TableCell>
                              <TableCell className="px-1 py-1 text-xs">
                                <div className="truncate" title={item.buyUnitMsr || item.purPackMsr || "pcs"}>
                                  {item.buyUnitMsr || item.purPackMsr || "pcs"}
                                </div>
                              </TableCell>
                              <TableCell className="px-1 py-1 text-xs">
                                <div className="truncate" title={`₱${item.cost?.toLocaleString() || "0.00"}`}>
                                  ₱{item.cost?.toFixed(0) || "0"}
                                </div>
                              </TableCell>
                              <TableCell className="px-1 py-1">
                                {isSelected && (
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={selectedItem?.quantity || 1}
                                    onChange={(e) => handleQuantityChange(item.itemId, parseInt(e.target.value) || 1)}
                                    className="w-10 h-6 text-xs px-1"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="px-1 py-1">
                                {isSelected && (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={selectedItem?.unitPrice || 0}
                                    onChange={(e) => handleUnitPriceChange(item.itemId, parseFloat(e.target.value) || 0)}
                                    className="w-16 h-6 text-xs px-1"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="px-1 py-1">
                                {isSelected && (
                                  <Input
                                    placeholder="Notes"
                                    value={selectedItem?.remarks || ""}
                                    onChange={(e) => handleRemarksChange(item.itemId, e.target.value)}
                                    className="w-16 h-6 text-xs px-1"
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="block md:hidden p-2 space-y-2">
                  {items.map((item) => {
                    const isSelected = selectedItems.has(item.itemId)
                    const selectedItem = selectedItems.get(item.itemId)
                    
                    return (
                      <div 
                        key={item.itemId} 
                        className={`border rounded-md p-2 cursor-pointer hover:bg-muted/30 ${isSelected ? "bg-muted/50 border-primary" : "bg-card"}`}
                        onClick={(e) => handleRowClick(item, e)}
                      >
                        <div className="flex items-start space-x-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleItemToggle(item, checked as boolean)}
                            className="mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-xs truncate" title={item.itemCode}>
                                  {item.itemCode}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={item.itemDesc}>
                                  {item.itemDesc}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xs font-medium">₱{item.cost?.toFixed(0) || "0"}</div>
                                <div className="text-xs text-muted-foreground">{item.buyUnitMsr || item.purPackMsr || "pcs"}</div>
                              </div>
                            </div>
                            
                            {isSelected && (
                              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t">
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">Qty</label>
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={selectedItem?.quantity || 1}
                                    onChange={(e) => handleQuantityChange(item.itemId, parseInt(e.target.value) || 1)}
                                    className="h-7 text-xs px-2"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">Price</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={selectedItem?.unitPrice || 0}
                                    onChange={(e) => handleUnitPriceChange(item.itemId, parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs px-2"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                                  <Input
                                    placeholder="..."
                                    value={selectedItem?.remarks || ""}
                                    onChange={(e) => handleRemarksChange(item.itemId, e.target.value)}
                                    className="h-7 text-xs px-2"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddSelectedItems}
            disabled={selectedItems.size === 0}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Add {selectedItems.size} Item(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}