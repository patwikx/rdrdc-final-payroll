"use client"

import { useCallback, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  IconBoxSeam,
  IconCategory,
  IconCheck,
  IconCirclePlus,
  IconCloudUpload,
  IconDownload,
  IconExclamationCircle,
  IconFileSpreadsheet,
  IconLoader2,
  IconPencil,
  IconSearch,
  IconX,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  bulkImportProcurementItemsAction,
  upsertProcurementItemAction,
  upsertProcurementItemCategoryAction,
  type BulkImportResultRow,
} from "@/modules/procurement/actions/procurement-item-catalog-actions"
import {
  BULK_ITEM_REQUIRED_HEADERS,
  BULK_ITEM_TEMPLATE_HEADERS,
} from "@/modules/procurement/schemas/procurement-bulk-import-schema"
import type {
  BulkItemTemplateHeader,
} from "@/modules/procurement/schemas/procurement-bulk-import-schema"
import type {
  ProcurementItemCatalogViewModel,
  ProcurementItemCategoryRow,
  ProcurementItemRow,
} from "@/modules/procurement/types/procurement-item-catalog-types"

// ─── Types ─────────────────────────────────────────────────────────

type ActiveTab = "items" | "categories"

type CategoryFormState = {
  categoryId?: string
  code: string
  name: string
  description: string
  isActive: boolean
}

type ItemFormState = {
  itemId?: string
  categoryId: string
  code: string
  name: string
  description: string
  uom: string
  unitPrice: string
  isActive: boolean
}

type BulkPreviewRow = {
  categoryCode: string
  categoryName: string
  itemCode: string
  itemName: string
  itemDescription: string
  uom: string
  unitPrice: string
  isActive: boolean
}

type ParsedBulkRows = {
  rows: BulkPreviewRow[]
  skippedInvalidCount: number
}

type BulkImportPhase = "idle" | "preview" | "importing" | "done"

type BulkImportProgress = {
  total: number
  processed: number
  created: number
  updated: number
  errors: number
  currentItemCode: string | null
  currentMessage: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  code: "",
  name: "",
  description: "",
  isActive: true,
}

const EMPTY_ITEM_FORM = (firstCategoryId: string): ItemFormState => ({
  categoryId: firstCategoryId,
  code: "",
  name: "",
  description: "",
  uom: "",
  unitPrice: "",
  isActive: true,
})

const BULK_HEADERS: readonly BulkItemTemplateHeader[] = BULK_ITEM_TEMPLATE_HEADERS
const BULK_REQUIRED_HEADERS: readonly BulkItemTemplateHeader[] = BULK_ITEM_REQUIRED_HEADERS

const BULK_HEADER_ALIASES: Record<BulkItemTemplateHeader, readonly string[]> = {
  categoryCode: ["categorycode", "catcode", "category"],
  categoryName: ["categoryname", "catname"],
  itemCode: ["itemcode", "code"],
  itemName: ["itemname", "name", "item"],
  itemDescription: ["itemdescription", "description", "details"],
  uom: ["uom", "unitofmeasure", "unit"],
  unitPrice: ["unitprice", "price"],
  isActive: ["isactive", "active"],
}

const BULK_IMPORT_CHUNK_SIZE = 150
const BULK_IMPORT_ROW_ANIMATION_DELAY_MS = 10

const EMPTY_BULK_PROGRESS: BulkImportProgress = {
  total: 0,
  processed: 0,
  created: 0,
  updated: 0,
  errors: 0,
  currentItemCode: null,
  currentMessage: null,
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const csvEscape = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const generateCsvTemplate = (): string => {
  const headerLine = BULK_HEADERS.join(",")
  const exampleLine = [
    "OFFICE",
    "Office Supplies",
    "PEN-BLK-001",
    "Black Ballpen",
    "Standard black ballpoint pen",
    "PCS",
    "15.00",
    "true",
  ].join(",")

  return [headerLine, exampleLine].join("\n")
}

const downloadBlob = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

const normalizeCsvHeader = (raw: string): string => {
  return raw
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
}

const parseCsvRow = (line: string): string[] => {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

const stringifySheetCell = (value: unknown): string => {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  if (typeof value === "boolean") return value ? "true" : "false"
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

const parseCsvGrid = (raw: string): string[][] => {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)

  return lines.map((line) => parseCsvRow(line))
}

const parseWorksheetGrid = (rows: unknown[][]): string[][] => {
  return rows
    .map((row) => row.map((cell) => stringifySheetCell(cell)))
    .filter((row) => row.some((cell) => cell.length > 0))
}

const parseBulkRowsFromGrid = (grid: string[][]): ParsedBulkRows => {
  if (grid.length === 0) {
    throw new Error("Import file is empty.")
  }

  const normalizedHeaderCells = grid[0].map((cell) => normalizeCsvHeader(cell))
  const headerMap = new Map<BulkItemTemplateHeader, number>()

  for (const header of BULK_HEADERS) {
    const aliases = BULK_HEADER_ALIASES[header]
    const index = normalizedHeaderCells.findIndex((normalized) => aliases.includes(normalized))
    if (index >= 0) {
      headerMap.set(header, index)
    }
  }

  const missingHeaders = BULK_REQUIRED_HEADERS.filter((header) => !headerMap.has(header))
  let dataStartRowIndex = 1

  if (missingHeaders.length > 0) {
    const firstRow = grid[0]
    const supportsHeaderlessThreeColumnFormat =
      missingHeaders.length === BULK_REQUIRED_HEADERS.length &&
      firstRow.length >= 3 &&
      firstRow[0].trim().length > 0 &&
      firstRow[1].trim().length > 0 &&
      firstRow[2].trim().length > 0

    if (!supportsHeaderlessThreeColumnFormat) {
      throw new Error(
        `Missing required columns: ${missingHeaders.join(", ")}. Use headers or upload a 3-column file (itemCode, itemName, uom).`
      )
    }

    headerMap.set("itemCode", 0)
    headerMap.set("itemName", 1)
    headerMap.set("uom", 2)
    dataStartRowIndex = 0
  }

  const getCell = (cells: string[], header: BulkItemTemplateHeader): string => {
    const index = headerMap.get(header)
    if (index === undefined || index >= cells.length) return ""
    return cells[index].trim()
  }

  const parsedRows: BulkPreviewRow[] = []
  let skippedInvalidCount = 0
  for (let rowIndex = dataStartRowIndex; rowIndex < grid.length; rowIndex += 1) {
    const cells = grid[rowIndex]
    const itemCode = getCell(cells, "itemCode")
    if (!itemCode) continue

    const itemName = getCell(cells, "itemName")
    const uom = getCell(cells, "uom")
    if (!itemName || !uom) {
      skippedInvalidCount += 1
      continue
    }

    const activeStr = getCell(cells, "isActive").toLowerCase()
    const isActive = activeStr === "" || activeStr === "true" || activeStr === "1" || activeStr === "yes"

    parsedRows.push({
      categoryCode: getCell(cells, "categoryCode"),
      categoryName: getCell(cells, "categoryName"),
      itemCode,
      itemName,
      itemDescription: getCell(cells, "itemDescription"),
      uom,
      unitPrice: getCell(cells, "unitPrice"),
      isActive,
    })
  }

  if (parsedRows.length === 0) {
    throw new Error("No valid data rows found in the import file.")
  }

  return {
    rows: parsedRows,
    skippedInvalidCount,
  }
}

const parseBulkImportFile = async (file: File): Promise<ParsedBulkRows> => {
  const normalizedFileName = file.name.toLowerCase()
  const isCsv = normalizedFileName.endsWith(".csv")
  const isExcel = normalizedFileName.endsWith(".xls") || normalizedFileName.endsWith(".xlsx")

  if (!isCsv && !isExcel) {
    throw new Error("Unsupported file format. Please upload a CSV, XLS, or XLSX file.")
  }

  if (isCsv) {
    const content = await file.text()
    return parseBulkRowsFromGrid(parseCsvGrid(content))
  }

  const XLSX = await import("xlsx")
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error("The uploaded spreadsheet has no worksheet.")
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false })
  return parseBulkRowsFromGrid(parseWorksheetGrid(rows))
}

// ─── Component Props ───────────────────────────────────────────────

type ProcurementItemCatalogSettingsPageProps = {
  companyId: string
  data: ProcurementItemCatalogViewModel
}

// ─── Main Component ────────────────────────────────────────────────

export function ProcurementItemCatalogSettingsPage({ companyId, data }: ProcurementItemCatalogSettingsPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>("items")

  // Search & filters
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [itemsPageSize, setItemsPageSize] = useState("10")
  const [itemsPage, setItemsPage] = useState(1)
  const [categoriesPageSize, setCategoriesPageSize] = useState("10")
  const [categoriesPage, setCategoriesPage] = useState(1)

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM)

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM(data.categories[0]?.id ?? ""))

  // Bulk import
  const [bulkPhase, setBulkPhase] = useState<BulkImportPhase>("idle")
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewRow[]>([])
  const [bulkResults, setBulkResults] = useState<BulkImportResultRow[]>([])
  const [bulkSummary, setBulkSummary] = useState({ created: 0, updated: 0, errors: 0 })
  const [bulkProgress, setBulkProgress] = useState<BulkImportProgress>(EMPTY_BULK_PROGRESS)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Filtered data ───────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.items.filter((item) => {
      if (statusFilter === "ACTIVE" && !item.isActive) return false
      if (statusFilter === "INACTIVE" && item.isActive) return false
      if (categoryFilter !== "ALL" && item.categoryId !== categoryFilter) return false
      if (!query) return true
      const hay = [item.code, item.name, item.categoryCode, item.categoryName, item.description ?? ""]
        .join(" ")
        .toLowerCase()
      return hay.includes(query)
    })
  }, [data.items, search, categoryFilter, statusFilter])

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.categories.filter((cat) => {
      if (statusFilter === "ACTIVE" && !cat.isActive) return false
      if (statusFilter === "INACTIVE" && cat.isActive) return false
      if (!query) return true
      const hay = [cat.code, cat.name, cat.description ?? ""].join(" ").toLowerCase()
      return hay.includes(query)
    })
  }, [data.categories, search, statusFilter])

  const itemsPerPage = useMemo(() => Math.max(1, Number(itemsPageSize) || 10), [itemsPageSize])
  const categoriesPerPage = useMemo(() => Math.max(1, Number(categoriesPageSize) || 10), [categoriesPageSize])

  const itemsTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredItems.length / itemsPerPage)), [filteredItems.length, itemsPerPage])
  const categoriesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCategories.length / categoriesPerPage)),
    [filteredCategories.length, categoriesPerPage]
  )

  const safeItemsPage = Math.min(Math.max(itemsPage, 1), itemsTotalPages)
  const safeCategoriesPage = Math.min(Math.max(categoriesPage, 1), categoriesTotalPages)

  const paginatedItems = useMemo(() => {
    const start = (safeItemsPage - 1) * itemsPerPage
    return filteredItems.slice(start, start + itemsPerPage)
  }, [filteredItems, itemsPerPage, safeItemsPage])

  const paginatedCategories = useMemo(() => {
    const start = (safeCategoriesPage - 1) * categoriesPerPage
    return filteredCategories.slice(start, start + categoriesPerPage)
  }, [filteredCategories, categoriesPerPage, safeCategoriesPage])

  // ─── Category Actions ────────────────────────────────────────────

  const openNewCategory = useCallback(() => {
    setCategoryForm(EMPTY_CATEGORY_FORM)
    setCategoryDialogOpen(true)
  }, [])

  const openEditCategory = useCallback((cat: ProcurementItemCategoryRow) => {
    setCategoryForm({
      categoryId: cat.id,
      code: cat.code,
      name: cat.name,
      description: cat.description ?? "",
      isActive: cat.isActive,
    })
    setCategoryDialogOpen(true)
  }, [])

  const handleSaveCategory = useCallback(() => {
    startTransition(async () => {
      const response = await upsertProcurementItemCategoryAction({
        companyId,
        categoryId: categoryForm.categoryId,
        code: categoryForm.code,
        name: categoryForm.name,
        description: categoryForm.description || undefined,
        isActive: categoryForm.isActive,
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      setCategoryDialogOpen(false)
      setCategoryForm(EMPTY_CATEGORY_FORM)
      router.refresh()
    })
  }, [companyId, categoryForm, router])

  // ─── Item Actions ────────────────────────────────────────────────

  const openNewItem = useCallback(() => {
    setItemForm(EMPTY_ITEM_FORM(data.categories[0]?.id ?? ""))
    setItemDialogOpen(true)
  }, [data.categories])

  const openEditItem = useCallback(
    (item: ProcurementItemRow) => {
      setItemForm({
        itemId: item.id,
        categoryId: item.categoryId,
        code: item.code,
        name: item.name,
        description: item.description ?? "",
        uom: item.uom,
        unitPrice: item.unitPrice === null ? "" : String(item.unitPrice),
        isActive: item.isActive,
      })
      setItemDialogOpen(true)
    },
    []
  )

  const handleSaveItem = useCallback(() => {
    if (!itemForm.categoryId) {
      toast.error("Category is required.")
      return
    }

    startTransition(async () => {
      const response = await upsertProcurementItemAction({
        companyId,
        itemId: itemForm.itemId,
        categoryId: itemForm.categoryId,
        code: itemForm.code,
        name: itemForm.name,
        description: itemForm.description || undefined,
        uom: itemForm.uom,
        unitPrice: itemForm.unitPrice.trim().length > 0 ? Number(itemForm.unitPrice) : undefined,
        isActive: itemForm.isActive,
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      setItemDialogOpen(false)
      setItemForm(EMPTY_ITEM_FORM(data.categories[0]?.id ?? ""))
      router.refresh()
    })
  }, [companyId, itemForm, data.categories, router])

  // ─── Bulk Import Actions ─────────────────────────────────────────

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = await parseBulkImportFile(file)
      const rows = parsed.rows
      setBulkPreview(rows)
      setBulkPhase("preview")
      setBulkDialogOpen(true)
      if (parsed.skippedInvalidCount > 0) {
        toast.warning(
          `Skipped ${parsed.skippedInvalidCount} row(s) with missing required fields (itemCode, itemName, uom).`
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse the selected file.")
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const handleBulkImport = useCallback(() => {
    const totalRows = bulkPreview.length
    if (totalRows === 0) {
      toast.error("No items queued for import.")
      return
    }

    setBulkResults([])
    setBulkSummary({ created: 0, updated: 0, errors: 0 })
    setBulkProgress({
      total: totalRows,
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      currentItemCode: null,
      currentMessage: "Preparing import batches…",
    })
    setBulkPhase("importing")

    const runImport = async () => {
      const payload = bulkPreview.map((row) => ({
        categoryCode: row.categoryCode,
        categoryName: row.categoryName,
        itemCode: row.itemCode,
        itemName: row.itemName,
        itemDescription: row.itemDescription || undefined,
        uom: row.uom,
        unitPrice: row.unitPrice ? Number(row.unitPrice) : undefined,
        isActive: row.isActive,
      }))

      let created = 0
      let updated = 0
      let errors = 0
      let processed = 0
      let haltedByError = false

      for (let chunkStart = 0; chunkStart < payload.length; chunkStart += BULK_IMPORT_CHUNK_SIZE) {
        const chunkRows = payload.slice(chunkStart, chunkStart + BULK_IMPORT_CHUNK_SIZE)
        const chunkResult = await bulkImportProcurementItemsAction({
          companyId,
          rows: chunkRows,
        })

        if (!chunkResult.ok) {
          haltedByError = true
          toast.error(chunkResult.error)
          setBulkProgress((prev) => ({
            ...prev,
            currentMessage: chunkResult.error,
          }))
          break
        }

        const mappedRows = chunkResult.rows.map((row) => ({
          ...row,
          rowIndex: chunkStart + row.rowIndex,
        }))

        for (const rowResult of mappedRows) {
          const createdDelta = rowResult.status === "created" ? 1 : 0
          const updatedDelta = rowResult.status === "updated" ? 1 : 0
          const errorDelta = rowResult.status === "error" ? 1 : 0

          created += createdDelta
          updated += updatedDelta
          errors += errorDelta
          processed += 1

          setBulkResults((prev) => [...prev, rowResult])
          setBulkProgress({
            total: totalRows,
            processed,
            created,
            updated,
            errors,
            currentItemCode: rowResult.itemCode,
            currentMessage: rowResult.message,
          })

          if (BULK_IMPORT_ROW_ANIMATION_DELAY_MS > 0) {
            await sleep(BULK_IMPORT_ROW_ANIMATION_DELAY_MS)
          }
        }
      }

      setBulkSummary({ created, updated, errors })
      setBulkProgress((prev) => ({
        ...prev,
        currentItemCode: null,
        currentMessage: haltedByError ? "Import stopped due to an error." : "Import complete.",
      }))
      setBulkPhase("done")

      if (haltedByError) {
        toast.warning(`Import stopped. Processed ${processed} of ${totalRows} item(s).`)
      } else if (errors === 0) {
        toast.success(`Import complete: ${created} created, ${updated} updated.`)
      } else {
        toast.warning(`Import complete with ${errors} error(s).`)
      }

      router.refresh()
    }

    void runImport()
  }, [companyId, bulkPreview, router])

  const handleDownloadTemplate = useCallback(() => {
    downloadBlob(generateCsvTemplate(), "item-catalog-template.csv")
    toast.success("Template downloaded.")
  }, [])

  const handleExportItems = useCallback(() => {
    const headerLine = BULK_HEADERS.join(",")
    const dataLines = data.items.map((item) =>
      [
        csvEscape(item.categoryCode),
        csvEscape(item.categoryName),
        csvEscape(item.code),
        csvEscape(item.name),
        csvEscape(item.description ?? ""),
        csvEscape(item.uom),
        item.unitPrice === null ? "" : String(item.unitPrice),
        String(item.isActive),
      ].join(",")
    )

    downloadBlob([headerLine, ...dataLines].join("\n"), "item-catalog-export.csv")
    toast.success(`Exported ${data.items.length} items.`)
  }, [data.items])

  const closeBulkDialog = useCallback(() => {
    if (bulkPhase === "importing") {
      return
    }

    setBulkDialogOpen(false)
    setBulkPhase("idle")
    setBulkPreview([])
    setBulkResults([])
    setBulkSummary({ created: 0, updated: 0, errors: 0 })
    setBulkProgress(EMPTY_BULK_PROGRESS)
  }, [bulkPhase])

  // ─── Stats ───────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalItems = data.items.length
    const activeItems = data.items.filter((i) => i.isActive).length
    const inactiveItems = totalItems - activeItems
    const totalCategories = data.categories.length
    return { totalItems, activeItems, inactiveItems, totalCategories }
  }, [data.items, data.categories])

  const itemCountByCategoryId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of data.items) {
      counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
    }
    return counts
  }, [data.items])

  const bulkProgressPercent = useMemo(() => {
    if (bulkProgress.total <= 0) return 0
    return Math.min(100, Math.round((bulkProgress.processed / bulkProgress.total) * 100))
  }, [bulkProgress.processed, bulkProgress.total])

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground">Purchasing Workspace</p>
          <div className="mt-2 flex items-center gap-4">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Global Item Catalog</h1>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {activeTab === "items" ? "Item Manager" : "Category Manager"}
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<IconBoxSeam className="h-4 w-4 text-primary" />} label="Total Items" value={stats.totalItems} />
          <StatCard icon={<IconCheck className="h-4 w-4 text-primary" />} label="Active Items" value={stats.activeItems} />
          <StatCard icon={<IconX className="h-4 w-4 text-primary" />} label="Inactive Items" value={stats.inactiveItems} />
          <StatCard
            icon={<IconCategory className="h-4 w-4 text-primary" />}
            label="Categories"
            value={stats.totalCategories}
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-0">
            <button
              type="button"
              onClick={() => setActiveTab("items")}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === "items"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <IconBoxSeam className="size-3.5" />
                Items
                <Badge variant="secondary" className="ml-1">
                  {data.items.length}
                </Badge>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("categories")}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === "categories"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <IconCategory className="size-3.5" />
                Categories
                <Badge variant="secondary" className="ml-1">
                  {data.categories.length}
                </Badge>
              </span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              {activeTab === "items" ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleExportItems}>
                        <IconDownload className="size-3.5" />
                        Export
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export all items as CSV</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <IconCloudUpload className="size-3.5" />
                        Bulk Import
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleDownloadTemplate}>
                        <IconFileSpreadsheet className="size-3.5" />
                        Download Template (CSV)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <IconCloudUpload className="size-3.5" />
                        Upload CSV/XLS/XLSX
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button size="sm" onClick={openNewItem}>
                    <IconCirclePlus className="size-3.5" />
                    Add Item
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={openNewCategory}>
                  <IconCirclePlus className="size-3.5" />
                  Add Category
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-[280px]">
              <IconSearch className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setItemsPage(1)
                  setCategoriesPage(1)
                }}
                placeholder={activeTab === "items" ? "Search items…" : "Search categories…"}
                className="pl-8"
              />
            </div>

            {activeTab === "items" ? (
              <Select
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value)
                  setItemsPage(1)
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {data.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as typeof statusFilter)
                setItemsPage(1)
                setCategoriesPage(1)
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <span className="ml-auto text-xs text-muted-foreground">
              {activeTab === "items" ? `${filteredItems.length} item(s)` : `${filteredCategories.length} category(ies)`}
            </span>
          </div>

          {activeTab === "items" ? (
            filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
                No items match the current filters.
              </div>
            ) : (
              <div className="overflow-hidden border border-border/60 bg-card">
                <div className="space-y-2 p-3 lg:hidden">
                  {paginatedItems.map((item) => (
                    <motion.div
                      key={`item-mobile-${item.id}`}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      className="rounded-xl border border-border/60 bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">Item Code</p>
                          <p className="truncate text-sm font-medium text-foreground">{item.code}</p>
                        </div>
                        <Badge variant={item.isActive ? "default" : "destructive"} className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]">
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div className="col-span-2">
                          <p className="text-[11px] text-muted-foreground">Name</p>
                          <p className="text-foreground">{item.name}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Category</p>
                          <p className="text-foreground">{item.categoryCode}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">UOM</p>
                          <p className="font-mono text-foreground">{item.uom}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] text-muted-foreground">Unit Price</p>
                          <p className="font-medium text-foreground">
                            {item.unitPrice === null ? "-" : `PHP ${currency.format(item.unitPrice)}`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => openEditItem(item)}>
                          <IconPencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="hidden lg:block">
                  <div className="overflow-x-auto">
                    <div className="min-w-[980px]">
                      <div className="grid grid-cols-12 items-center gap-1 border-b border-border/60 bg-muted/30 px-3 py-2">
                        <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Code</p>
                        <p className="col-span-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Name</p>
                        <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Category</p>
                        <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">UOM</p>
                        <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Unit Price</p>
                        <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                        <p className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                      </div>

                      {paginatedItems.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                          className="grid grid-cols-12 items-center gap-1 border-b border-border/60 px-3 py-2 text-xs last:border-b-0 hover:bg-muted/20"
                        >
                          <div className="col-span-2 truncate font-mono text-foreground" title={item.code}>
                            {item.code}
                          </div>
                          <div className="col-span-3 min-w-0">
                            <p className="truncate text-foreground" title={item.name}>
                              {item.name}
                            </p>
                            {item.description ? (
                              <p className="truncate text-[11px] text-muted-foreground" title={item.description}>
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="col-span-2 truncate text-foreground" title={item.categoryName}>
                            {item.categoryCode}
                          </div>
                          <div className="col-span-1 font-mono text-foreground">{item.uom}</div>
                          <div className="col-span-1 text-foreground">
                            {item.unitPrice === null ? "-" : `PHP ${currency.format(item.unitPrice)}`}
                          </div>
                          <div className="col-span-1">
                            <Badge variant={item.isActive ? "default" : "destructive"} className="w-full justify-center rounded-full border px-2 py-1 text-[10px] shadow-none">
                              {item.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEditItem(item)}>
                                  <IconPencil className="h-4 w-4" />
                                  <span className="sr-only">Edit Item</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Edit Item
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-muted-foreground">
                      Page {safeItemsPage} of {itemsTotalPages} • {filteredItems.length} records
                    </p>
                    <Select
                      value={itemsPageSize}
                      onValueChange={(value) => {
                        setItemsPageSize(value)
                        setItemsPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 w-[112px] rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 / page</SelectItem>
                        <SelectItem value="20">20 / page</SelectItem>
                        <SelectItem value="30">30 / page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      disabled={safeItemsPage <= 1}
                      onClick={() => setItemsPage(safeItemsPage - 1)}
                    >
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      disabled={safeItemsPage >= itemsTotalPages}
                      onClick={() => setItemsPage(safeItemsPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )
          ) : filteredCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              No categories match the current filters.
            </div>
          ) : (
            <div className="overflow-hidden border border-border/60 bg-card">
              <div className="space-y-2 p-3 lg:hidden">
                {paginatedCategories.map((category) => {
                  const itemCount = itemCountByCategoryId.get(category.id) ?? 0
                  return (
                    <motion.div
                      key={`category-mobile-${category.id}`}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      className="rounded-xl border border-border/60 bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">Category Code</p>
                          <p className="truncate text-sm font-medium text-foreground">{category.code}</p>
                        </div>
                        <Badge variant={category.isActive ? "default" : "destructive"} className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]">
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Name</p>
                          <p className="text-foreground">{category.name}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Items</p>
                          <p className="text-foreground">{itemCount}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px] text-muted-foreground">Description</p>
                          <p className="text-foreground">{category.description || "-"}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          onClick={() => openEditCategory(category)}
                        >
                          <IconPencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <div className="hidden lg:block">
                <div className="overflow-x-auto">
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-12 items-center gap-1 border-b border-border/60 bg-muted/30 px-3 py-2">
                      <p className="col-span-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Code</p>
                      <p className="col-span-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Name</p>
                      <p className="col-span-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                      <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Items</p>
                      <p className="col-span-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="col-span-1 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                    </div>

                    {paginatedCategories.map((category) => {
                      const itemCount = itemCountByCategoryId.get(category.id) ?? 0
                      return (
                        <motion.div
                          key={category.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                          className="grid grid-cols-12 items-center gap-1 border-b border-border/60 px-3 py-2 text-xs last:border-b-0 hover:bg-muted/20"
                        >
                          <div className="col-span-2 truncate font-mono text-foreground" title={category.code}>
                            {category.code}
                          </div>
                          <div className="col-span-3 truncate text-foreground" title={category.name}>
                            {category.name}
                          </div>
                          <div className="col-span-4 truncate text-foreground" title={category.description ?? "-"}>
                            {category.description || "-"}
                          </div>
                          <div className="col-span-1 text-foreground">{itemCount}</div>
                          <div className="col-span-1">
                            <Badge variant={category.isActive ? "default" : "destructive"} className="w-full justify-center rounded-full border px-2 py-1 text-[10px] shadow-none">
                              {category.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="col-span-1 flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openEditCategory(category)}
                                >
                                  <IconPencil className="h-4 w-4" />
                                  <span className="sr-only">Edit Category</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6}>
                                Edit Category
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground">
                    Page {safeCategoriesPage} of {categoriesTotalPages} • {filteredCategories.length} records
                  </p>
                  <Select
                    value={categoriesPageSize}
                    onValueChange={(value) => {
                      setCategoriesPageSize(value)
                      setCategoriesPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[112px] rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="20">20 / page</SelectItem>
                      <SelectItem value="30">30 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    disabled={safeCategoriesPage <= 1}
                    onClick={() => setCategoriesPage(safeCategoriesPage - 1)}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    disabled={safeCategoriesPage >= categoriesTotalPages}
                    onClick={() => setCategoriesPage(safeCategoriesPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={handleFileSelect}
        />
        </div>

        {/* ─── Category Dialog ─────────────────────────────────────── */}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{categoryForm.categoryId ? "Edit Category" : "New Category"}</DialogTitle>
              <DialogDescription>
                {categoryForm.categoryId
                  ? "Update the category details below."
                  : "Fill in the details to create a new item category."}
              </DialogDescription>
            </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>
                    Code
                    <Required />
                  </Label>
                  <Input
                    value={categoryForm.code}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="OFFICE"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Name
                    <Required />
                  </Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Office Supplies"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Optional description…"
                />
              </div>
              <div className="flex h-9 items-center justify-between rounded-md border border-input px-3">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch
                  checked={categoryForm.isActive}
                  onCheckedChange={(checked) => setCategoryForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button disabled={isPending} onClick={handleSaveCategory}>
                {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
                {categoryForm.categoryId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Item Dialog ─────────────────────────────────────────── */}
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{itemForm.itemId ? "Edit Item" : "New Item"}</DialogTitle>
              <DialogDescription>
                {itemForm.itemId
                  ? "Update the item details below."
                  : "Fill in the details to add a new item to the catalog."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>
                  Category
                  <Required />
                </Label>
                <Select
                  value={itemForm.categoryId}
                  onValueChange={(v) => setItemForm((prev) => ({ ...prev, categoryId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.code} – {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Item Code
                    <Required />
                  </Label>
                  <Input
                    value={itemForm.code}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="PEN-BLK-001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    UOM
                    <Required />
                  </Label>
                  <Input
                    value={itemForm.uom}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, uom: e.target.value }))}
                    placeholder="PCS"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Item Name
                  <Required />
                </Label>
                <Input
                  value={itemForm.name}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Black Ballpen"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Optional description…"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Default Unit Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.unitPrice}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex h-9 items-center justify-between rounded-md border border-input px-3 self-end">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch
                    checked={itemForm.isActive}
                    onCheckedChange={(checked) => setItemForm((prev) => ({ ...prev, isActive: checked }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button disabled={isPending} onClick={handleSaveItem}>
                {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
                {itemForm.itemId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Bulk Import Dialog ──────────────────────────────────── */}
        <Dialog open={bulkDialogOpen} onOpenChange={(open) => !open && closeBulkDialog()}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconCloudUpload className="size-4" />
                Bulk Import Items
              </DialogTitle>
              <DialogDescription>
                {bulkPhase === "preview" && `${bulkPreview.length} row(s) ready for import. Review the data below.`}
                {bulkPhase === "importing" &&
                  `Importing ${bulkProgress.processed} of ${bulkProgress.total} item(s)…`}
                {bulkPhase === "done" && "Import complete. See the results below."}
              </DialogDescription>
            </DialogHeader>

            {/* Preview Phase */}
            {bulkPhase === "preview" && (
              <>
                <div className="overflow-auto flex-1 rounded-md border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Cat. Code</TableHead>
                        <TableHead>Cat. Name</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkPreview.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono">{row.categoryCode}</TableCell>
                          <TableCell>{row.categoryName}</TableCell>
                          <TableCell className="font-mono font-medium">{row.itemCode}</TableCell>
                          <TableCell>{row.itemName}</TableCell>
                          <TableCell className="font-mono">{row.uom}</TableCell>
                          <TableCell className="text-right font-mono">{row.unitPrice || "–"}</TableCell>
                          <TableCell>
                            <Badge variant={row.isActive ? "default" : "destructive"}>
                              {row.isActive ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={closeBulkDialog}>
                    Cancel
                  </Button>
                  <Button disabled={isPending} onClick={handleBulkImport}>
                    {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
                    Import {bulkPreview.length} Item(s)
                  </Button>
                </DialogFooter>
              </>
            )}

            {/* Importing Phase */}
            {bulkPhase === "importing" && (
              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                <div className="space-y-2 rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Processed {bulkProgress.processed} / {bulkProgress.total}
                    </span>
                    <span>{bulkProgressPercent}%</span>
                  </div>
                  <Progress value={bulkProgressPercent} className="h-2" />
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1">
                      <span className="text-muted-foreground">Created:</span>{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{bulkProgress.created}</span>
                    </div>
                    <div className="rounded border border-blue-500/20 bg-blue-500/5 px-2 py-1">
                      <span className="text-muted-foreground">Updated:</span>{" "}
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{bulkProgress.updated}</span>
                    </div>
                    <div className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1">
                      <span className="text-muted-foreground">Errors:</span>{" "}
                      <span className="font-semibold text-red-600 dark:text-red-400">{bulkProgress.errors}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <IconLoader2 className="size-3.5 animate-spin text-primary" />
                    <span className="font-mono">
                      {bulkProgress.currentItemCode ? `Current: ${bulkProgress.currentItemCode}` : "Processing…"}
                    </span>
                    {bulkProgress.currentMessage && <span className="truncate">• {bulkProgress.currentMessage}</span>}
                  </div>
                </div>

                <div className="overflow-auto rounded-md border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                            Waiting for first batch result…
                          </TableCell>
                        </TableRow>
                      ) : (
                        [...bulkResults].slice(-80).map((row) => (
                          <TableRow key={row.rowIndex}>
                            <TableCell className="text-muted-foreground">{row.rowIndex + 1}</TableCell>
                            <TableCell className="font-mono font-medium">{row.itemCode}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.status === "created"
                                    ? "default"
                                    : row.status === "updated"
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{row.message}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Done Phase */}
            {bulkPhase === "done" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{bulkSummary.created}</p>
                    <p className="text-xs text-muted-foreground">Created</p>
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-center">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{bulkSummary.updated}</p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{bulkSummary.errors}</p>
                    <p className="text-xs text-muted-foreground">Errors</p>
                  </div>
                </div>

                {bulkResults.length > 0 && (
                  <div className="overflow-auto flex-1 rounded-md border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkResults.map((row) => (
                          <TableRow key={row.rowIndex}>
                            <TableCell className="text-muted-foreground">{row.rowIndex + 1}</TableCell>
                            <TableCell className="font-mono font-medium">{row.itemCode}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.status === "created"
                                    ? "default"
                                    : row.status === "updated"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {row.status === "created" && <IconCheck className="size-2.5" />}
                                {row.status === "updated" && <IconPencil className="size-2.5" />}
                                {row.status === "error" && <IconExclamationCircle className="size-2.5" />}
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{row.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <DialogFooter>
                  <Button onClick={closeBulkDialog}>Close</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon}
      </div>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
    </div>
  )
}
