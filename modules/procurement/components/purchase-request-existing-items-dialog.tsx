"use client"

import { useEffect, useState } from "react"
import { IconSearch } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ProcurementItemOption = {
  id: string
  categoryId: string
  categoryCode: string
  categoryName: string
  code: string
  name: string
  description: string | null
  uom: string
  unitPrice: number | null
}

type ProcurementCategoryOption = {
  id: string
  code: string
  name: string
}

export type PurchaseRequestExistingItemSelection = {
  procurementItemId: string
  itemCode: string
  description: string
  uom: string
  quantity: string
  unitPrice: string
  remarks: string
}

type ProcurementItemsResponse = {
  success: boolean
  data?: {
    categories: ProcurementCategoryOption[]
    items: ProcurementItemOption[]
  }
  error?: string
}

type PurchaseRequestExistingItemsDialogProps = {
  companyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onItemsSelected: (items: PurchaseRequestExistingItemSelection[]) => void
}

const SEARCH_DEBOUNCE_MS = 250

export function PurchaseRequestExistingItemsDialog({
  companyId,
  open,
  onOpenChange,
  onItemsSelected,
}: PurchaseRequestExistingItemsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL")
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<ProcurementCategoryOption[]>([])
  const [items, setItems] = useState<ProcurementItemOption[]>([])
  const [selectedItemsById, setSelectedItemsById] = useState<Map<string, ProcurementItemOption>>(new Map())

  useEffect(() => {
    if (!open) {
      setSearchTerm("")
      setDebouncedSearchTerm("")
      setSelectedCategoryId("ALL")
      setIsLoading(false)
      setCategories([])
      setItems([])
      setSelectedItemsById(new Map())
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [open, searchTerm])

  useEffect(() => {
    if (!open) {
      setIsLoading(false)
      return
    }

    const abortController = new AbortController()
    setIsLoading(true)

    const loadItems = async () => {
      try {
        const params = new URLSearchParams()
        params.set("companyId", companyId)

        if (debouncedSearchTerm.length > 0) {
          params.set("search", debouncedSearchTerm)
        }

        if (selectedCategoryId !== "ALL") {
          params.set("categoryId", selectedCategoryId)
        }

        const response = await fetch(`/api/procurement-items?${params.toString()}`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error("Unable to load procurement items.")
        }

        const payload = (await response.json()) as ProcurementItemsResponse
        if (!payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to load procurement items.")
        }

        setCategories(payload.data.categories)
        setItems(payload.data.items)
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        const message = error instanceof Error ? error.message : "Unable to load procurement items."
        toast.error(message)
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadItems()

    return () => {
      abortController.abort()
    }
  }, [companyId, debouncedSearchTerm, open, selectedCategoryId])

  const toggleSelection = (itemId: string, checked: boolean) => {
    const item = items.find((currentItem) => currentItem.id === itemId)
    if (!item && checked) {
      return
    }

    setSelectedItemsById((previous) => {
      const next = new Map(previous)
      if (checked) {
        if (item) {
          next.set(itemId, item)
        }
      } else {
        next.delete(itemId)
      }

      return next
    })
  }

  const handleAddSelected = () => {
    const selectedItems = Array.from(selectedItemsById.values()).map((item) => ({
      procurementItemId: item.id,
      itemCode: item.code.trim().toUpperCase(),
      description: (item.description ?? item.name).trim(),
      uom: item.uom.trim().toUpperCase(),
      quantity: "1",
      unitPrice: item.unitPrice !== null ? item.unitPrice.toFixed(2) : "",
      remarks: "",
    }))

    if (selectedItems.length === 0) {
      toast.error("Select at least one existing item.")
      return
    }

    onItemsSelected(selectedItems)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[95vw] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add Existing Items (Global Catalog)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search item code, name, or description"
                className="pl-8"
              />
            </div>

            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.code} - {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">{selectedItemsById.size} selected</div>


          <div className="overflow-hidden rounded-md border border-border/60">
            <div className="h-[24rem] overflow-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"> </TableHead>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead className="w-[180px]">Category</TableHead>
                    <TableHead>Name / Description</TableHead>
                    <TableHead className="w-[90px]">UOM</TableHead>
                    <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const isSelected = selectedItemsById.has(item.id)

                    return (
                      <TableRow
                        key={item.id}
                        className={isSelected ? "cursor-pointer bg-muted/40 text-xs" : "cursor-pointer text-xs hover:bg-muted/30"}
                        onClick={() => toggleSelection(item.id, !isSelected)}
                      >
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleSelection(item.id, checked === true)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium">{item.categoryCode}</p>
                            <p className="text-muted-foreground">{item.categoryName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-muted-foreground">{item.description ?? "-"}</p>
                        </TableCell>
                        <TableCell>{item.uom}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.unitPrice !== null ? item.unitPrice.toFixed(2) : "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                        Loading catalog items...
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!isLoading && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                        No catalog items found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleAddSelected} disabled={selectedItemsById.size === 0}>
            Add Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
