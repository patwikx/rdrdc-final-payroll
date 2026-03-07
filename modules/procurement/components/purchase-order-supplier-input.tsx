"use client"

import { useEffect, useMemo, useState } from "react"
import { IconCheck, IconChevronDown } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type PurchaseOrderSupplierOption = {
  supplierCode: string | null
  supplierName: string | null
}

type PurchaseOrderSuppliersResponse = {
  success: boolean
  data: PurchaseOrderSupplierOption[]
  error?: string
}

type PurchaseOrderSupplierInputProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  maxLength?: number
}

const SEARCH_DEBOUNCE_MS = 250
const FALLBACK_SUPPLIER_LABEL = "Unnamed Supplier"

const normalizeSupplierDisplayName = (supplier: PurchaseOrderSupplierOption): string => {
  const supplierName = supplier.supplierName?.trim()
  if (supplierName) {
    return supplierName
  }

  const supplierCode = supplier.supplierCode?.trim()
  if (supplierCode) {
    return supplierCode
  }

  return FALLBACK_SUPPLIER_LABEL
}

export function PurchaseOrderSupplierInput({
  value,
  onChange,
  disabled = false,
  maxLength = 200,
}: PurchaseOrderSupplierInputProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<PurchaseOrderSupplierOption[]>([])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setDebouncedSearch("")
      setLoadError(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [open, search])

  useEffect(() => {
    if (!open) {
      return
    }

    const abortController = new AbortController()
    setIsLoading(true)
    setLoadError(null)

    const loadSuppliers = async () => {
      try {
        const params = new URLSearchParams()
        if (debouncedSearch.length > 0) {
          params.set("search", debouncedSearch)
        }

        const response = await fetch(`/api/po-suppliers?${params.toString()}`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error("Unable to load PO supplier list.")
        }

        const payload = (await response.json()) as PurchaseOrderSuppliersResponse
        if (!payload.success) {
          throw new Error(payload.error ?? "Unable to load PO supplier list.")
        }

        setSuppliers(payload.data)
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setSuppliers([])
        setLoadError(error instanceof Error ? error.message : "Unable to load PO supplier list.")
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      abortController.abort()
    }
  }, [open, debouncedSearch])

  const normalizedValue = value.trim().toLowerCase()
  const visibleSuppliers = useMemo(() => suppliers.slice(0, 200), [suppliers])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Supplier name"
          maxLength={maxLength}
          disabled={disabled}
        />

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" disabled={disabled} className="shrink-0 rounded-lg px-3">
              Select
              <IconChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[30rem] max-w-[calc(100vw-2rem)] p-0">
            <div className="border-b border-border/60 p-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search supplier code or name..."
              />
            </div>

            <div className="max-h-[18rem] overflow-y-auto overscroll-contain p-1" onWheel={(event) => event.stopPropagation()}>
              {isLoading ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">Loading suppliers...</p> : null}
              {!isLoading && loadError ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">{loadError}</p> : null}
              {!isLoading && !loadError && visibleSuppliers.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">No suppliers found.</p>
              ) : null}
              {!isLoading && !loadError && visibleSuppliers.length > 0
                ? visibleSuppliers.map((supplier) => {
                    const supplierDisplayName = normalizeSupplierDisplayName(supplier)
                    const supplierCodeLabel = supplier.supplierCode?.trim() || "-"
                    const isSelected = normalizedValue === supplierDisplayName.toLowerCase()

                    return (
                      <button
                        key={`${supplierCodeLabel}-${supplierDisplayName}`}
                        type="button"
                        onClick={() => {
                          onChange(supplierDisplayName)
                          setOpen(false)
                        }}
                        className="hover:bg-muted flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{supplierDisplayName}</p>
                          <p className="truncate text-xs text-muted-foreground">{supplierCodeLabel}</p>
                        </div>
                        <IconCheck className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      </button>
                    )
                  })
                : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-xs text-muted-foreground">Type manually or pick from the PO supplier list.</p>
    </div>
  )
}
