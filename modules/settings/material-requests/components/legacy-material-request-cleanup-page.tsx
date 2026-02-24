"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconAlertTriangle,
  IconBuilding,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDatabaseImport,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deleteLegacyMaterialRequestsAction } from "@/modules/settings/material-requests/actions/delete-legacy-material-requests-action"
import { legacyMaterialRequestDeleteConfirmationPhrase } from "@/modules/settings/material-requests/schemas/delete-legacy-material-requests-schema"

type LegacyMaterialRequestCleanupPageProps = {
  companyId: string
  companyName: string
  summary: {
    totalLegacyRequests: number
    requestsWithLegacyRecordId: number
    requestsWithLegacySourceSystem: number
    firstCreatedAt: string | null
    lastCreatedAt: string | null
  }
  rows: Array<{
    id: string
    requestNumber: string
    legacySourceSystem: string | null
    legacyRecordId: string | null
    status: string
    requesterName: string
    requesterEmployeeNumber: string
    departmentCode: string
    departmentName: string
    datePrepared: string
    createdAt: string
    updatedAt: string
  }>
}

const REQUIRED = <span className="ml-1 text-destructive">*</span>
const ROWS_PAGE_SIZE = 15

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "N/A"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "N/A"
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const formatDateOnly = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date)
}

export function LegacyMaterialRequestCleanupPage({
  companyId,
  companyName,
  summary,
  rows,
}: LegacyMaterialRequestCleanupPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmationText, setConfirmationText] = useState("")
  const [search, setSearch] = useState("")
  const [rowsPage, setRowsPage] = useState(1)

  const hasLegacyRows = summary.totalLegacyRequests > 0
  const isConfirmationValid = confirmationText.trim() === legacyMaterialRequestDeleteConfirmationPhrase
  const canDelete = hasLegacyRows && isConfirmationValid && !isPending

  const timelineLabel =
    !summary.firstCreatedAt && !summary.lastCreatedAt
      ? "No legacy request timestamps found."
      : `Oldest: ${formatDateTime(summary.firstCreatedAt)} • Newest: ${formatDateTime(summary.lastCreatedAt)}`

  const filteredRows = useMemo(() => {
    const searchKey = search.trim().toLowerCase()
    if (!searchKey) {
      return rows
    }

    return rows.filter((row) => {
      const values = [
        row.requestNumber,
        row.legacyRecordId ?? "",
        row.legacySourceSystem ?? "",
        row.status,
        row.requesterName,
        row.requesterEmployeeNumber,
        row.departmentCode,
        row.departmentName,
      ]

      return values.some((value) => value.toLowerCase().includes(searchKey))
    })
  }, [rows, search])

  const rowsTotalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PAGE_SIZE))
  const safeRowsPage = Math.min(rowsPage, rowsTotalPages)
  const pagedRows = filteredRows.slice((safeRowsPage - 1) * ROWS_PAGE_SIZE, safeRowsPage * ROWS_PAGE_SIZE)

  const handleDelete = () => {
    if (!canDelete) {
      toast.error(`Type "${legacyMaterialRequestDeleteConfirmationPhrase}" to continue.`)
      return
    }

    startTransition(async () => {
      const response = await deleteLegacyMaterialRequestsAction({
        companyId,
        confirmationText,
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      setConfirmationText("")
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">System Settings</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                <IconTrash className="size-5 text-destructive" />
                Legacy Material Request Cleanup
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {companyName}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Permanently remove legacy-tagged material requests so you can rerun the sync from a clean state.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm" className="h-8 px-2">
              <Link href={`/${companyId}/settings/material-requests`}>
                <IconCheck className="size-4" />
                Approval Settings
              </Link>
            </Button>
            <Button asChild type="button" variant="outline" size="sm" className="h-8 px-2">
              <Link href={`/${companyId}/settings/material-requests/legacy-sync`}>
                <IconDatabaseImport className="size-4" />
                Legacy Sync
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="space-y-5 px-4 py-6 sm:px-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Legacy Data Summary</CardTitle>
            <CardDescription>{timelineLabel}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border border-border/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Legacy Requests</p>
              <p className="text-2xl font-semibold text-foreground">{summary.totalLegacyRequests}</p>
            </div>
            <div className="border border-border/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">With Legacy Record ID</p>
              <p className="text-2xl font-semibold text-foreground">{summary.requestsWithLegacyRecordId}</p>
            </div>
            <div className="border border-border/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">With Legacy Source Tag</p>
              <p className="text-2xl font-semibold text-foreground">{summary.requestsWithLegacySourceSystem}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Legacy-Synced Material Requests</CardTitle>
            <CardDescription>
              Review exact synced rows before deletion. Related items, approvals, serve-batches, and postings will be deleted with each request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search request #, legacy record ID, status, requester, department..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setRowsPage(1)
              }}
              className="max-w-xl"
            />
            <div className="overflow-x-auto border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Request</TableHead>
                    <TableHead>Legacy Record</TableHead>
                    <TableHead>Legacy Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Date Prepared</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length > 0 ? (
                    pagedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs font-medium">{row.requestNumber}</TableCell>
                        <TableCell className="text-xs">{row.legacyRecordId ?? "-"}</TableCell>
                        <TableCell className="text-xs">{row.legacySourceSystem ?? "-"}</TableCell>
                        <TableCell className="text-xs">{row.status}</TableCell>
                        <TableCell className="text-xs">
                          <div>{row.requesterName}</div>
                          <div className="text-muted-foreground">{row.requesterEmployeeNumber}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{row.departmentName}</div>
                          <div className="text-muted-foreground">{row.departmentCode}</div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDateOnly(row.datePrepared)}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(row.createdAt)}</TableCell>
                        <TableCell className="text-xs">{formatDateTime(row.updatedAt)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                        {rows.length === 0
                          ? "No legacy-tagged material requests found."
                          : "No rows matched your search."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Page {safeRowsPage} of {rowsTotalPages} • {filteredRows.length} row(s)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={safeRowsPage <= 1}
                  onClick={() => setRowsPage((previous) => Math.max(1, previous - 1))}
                >
                  <IconChevronLeft className="size-3.5" />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={safeRowsPage >= rowsTotalPages}
                  onClick={() => setRowsPage((previous) => Math.min(rowsTotalPages, previous + 1))}
                >
                  Next
                  <IconChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base text-destructive">
              <IconAlertTriangle className="size-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-destructive/90">
              This is irreversible. Only legacy-tagged material requests are deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="legacy-cleanup-confirmation">
                Type exact confirmation to enable delete
                {REQUIRED}
              </Label>
              <Input
                id="legacy-cleanup-confirmation"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={legacyMaterialRequestDeleteConfirmationPhrase}
                className="border-destructive/40 focus-visible:ring-destructive/40"
              />
              <p className="text-xs text-muted-foreground">
                Required text: <span className="font-medium">{legacyMaterialRequestDeleteConfirmationPhrase}</span>
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  disabled={!hasLegacyRows || !isConfirmationValid || isPending}
                >
                  <IconTrash className="size-4" />
                  {isPending ? "Deleting..." : "Delete Legacy Material Requests"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Legacy Material Requests?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {summary.totalLegacyRequests} legacy-tagged material request(s) from{" "}
                    {companyName}, including related approval/process records.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={!canDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirm Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
