"use client"

import { useEffect, useState } from "react"
import { IconSearch } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ExistingCatalogItem = {
  itemId: string
  itemCode: string
  itemDesc: string
  buyUnitMsr: string | null
  purPackMsr: string | null
  cost: number
}

export type ExistingCatalogItemSelection = {
  itemCode: string
  description: string
  uom: string
  quantity: string
  unitPrice: string
  remarks: string
}

type ExistingCatalogItemsResponse = {
  success: boolean
  data: ExistingCatalogItem[]
  error?: string
}

type MaterialRequestExistingItemsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onItemsSelected: (items: ExistingCatalogItemSelection[]) => void
}

const SEARCH_DEBOUNCE_MS = 250

const normalizeUnitOfMeasure = (item: ExistingCatalogItem): string => {
  const raw = item.buyUnitMsr ?? item.purPackMsr ?? "PCS"
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed.toUpperCase() : "PCS"
}

export function MaterialRequestExistingItemsDialog({
  open,
  onOpenChange,
  onItemsSelected,
}: MaterialRequestExistingItemsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<ExistingCatalogItem[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) {
      setSearchTerm("")
      setDebouncedSearchTerm("")
      setIsLoading(false)
      setItems([])
      setSelectedItemIds(new Set())
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
        if (debouncedSearchTerm.length > 0) {
          params.set("search", debouncedSearchTerm)
        }
        const response = await fetch(`/api/mrs-items?${params.toString()}`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error("Unable to load catalog items.")
        }

        const payload = (await response.json()) as ExistingCatalogItemsResponse
        if (!payload.success) {
          throw new Error(payload.error ?? "Unable to load catalog items.")
        }

        setItems(payload.data)
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        const message = error instanceof Error ? error.message : "Unable to load catalog items."
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
  }, [open, debouncedSearchTerm])

  const toggleSelection = (item: ExistingCatalogItem, checked: boolean) => {
    setSelectedItemIds((previous) => {
      const next = new Set(previous)
      if (checked) {
        next.add(item.itemId)
      } else {
        next.delete(item.itemId)
      }

      return next
    })
  }

  const handleAddSelected = () => {
    const selectedItems = items
      .filter((item) => selectedItemIds.has(item.itemId))
      .map((item) => {
        return {
          itemCode: item.itemCode.trim().toUpperCase(),
          description: item.itemDesc.trim(),
          uom: normalizeUnitOfMeasure(item),
          quantity: "1",
          unitPrice: item.cost > 0 ? item.cost.toFixed(2) : "",
          remarks: "",
        }
      })

    if (selectedItems.length === 0) {
      toast.error("Select at least one existing item.")
      return
    }

    onItemsSelected(selectedItems)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Existing Items</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item code or description"
              className="pl-8"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            {selectedItemIds.size} selected
          </div>

          <div className="overflow-hidden rounded-md border border-border/60">
            <div className="h-[24rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 z-20 w-10 bg-background"> </TableHead>
                    <TableHead className="sticky top-0 z-20 w-[120px] bg-background">Code</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-background">Description</TableHead>
                    <TableHead className="sticky top-0 z-20 w-[90px] bg-background">UOM</TableHead>
                    <TableHead className="sticky top-0 z-20 w-[110px] bg-background text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const isSelected = selectedItemIds.has(item.itemId)

                    return (
                      <TableRow
                        key={item.itemId}
                        className={isSelected ? "cursor-pointer bg-muted/40" : "cursor-pointer hover:bg-muted/30"}
                        onClick={() => toggleSelection(item, !isSelected)}
                      >
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleSelection(item, checked === true)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.itemCode}</TableCell>
                        <TableCell>{item.itemDesc}</TableCell>
                        <TableCell>{normalizeUnitOfMeasure(item)}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.cost.toFixed(2)}</TableCell>
                      </TableRow>
                    )
                  })}

                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        Loading existing items...
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!isLoading && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No existing items found.
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
          <Button type="button" onClick={handleAddSelected} disabled={selectedItemIds.size === 0}>
            Add Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
