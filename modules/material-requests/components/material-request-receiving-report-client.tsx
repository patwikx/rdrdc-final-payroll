"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  IconChecklist,
  IconExternalLink,
  IconFileCheck,
  IconFilterOff,
  IconReceipt2,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  getMaterialRequestReceivingReportPageAction,
} from "@/modules/material-requests/actions/material-request-receiving-actions"
import type {
  EmployeePortalMaterialRequestDepartmentOption,
  EmployeePortalMaterialRequestReceivingReportRow,
  EmployeePortalMaterialRequestReceivingReportStatusFilter,
} from "@/modules/material-requests/types/employee-portal-material-request-types"

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const SEARCH_DEBOUNCE_MS = 300

type MaterialRequestReceivingReportClientProps = {
  companyId: string
  departmentOptions: EmployeePortalMaterialRequestDepartmentOption[]
  initialRows: EmployeePortalMaterialRequestReceivingReportRow[]
  initialTotal: number
  initialPage: number
  initialPageSize: number
  canViewCompanyWide: boolean
}

const postingStatusVariant = (status: "PENDING_POSTING" | "POSTED"): "default" | "secondary" | "outline" => {
  if (status === "POSTED") {
    return "default"
  }

  return "secondary"
}

const postingStatusLabel = (status: string): string => status.replace(/_/g, " ")

const getNameInitials = (fullName: string): string => {
  const initials = fullName
    .split(" ")
    .filter((part) => part.trim().length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return initials || "MR"
}

export function MaterialRequestReceivingReportClient({
  companyId,
  departmentOptions,
  initialRows,
  initialTotal,
  initialPage,
  initialPageSize,
  canViewCompanyWide,
}: MaterialRequestReceivingReportClientProps) {
  const loadTokenRef = useRef(0)
  const searchDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(String(initialPageSize))
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<EmployeePortalMaterialRequestReceivingReportStatusFilter>("ALL")
  const [departmentId, setDepartmentId] = useState<string>("ALL")

  const [isListPending, startListTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / Number(pageSize)))

  useEffect(() => {
    return () => {
      if (searchDebounceTimeoutRef.current) {
        clearTimeout(searchDebounceTimeoutRef.current)
      }
    }
  }, [])

  const clearSearchDebounceTimeout = () => {
    if (!searchDebounceTimeoutRef.current) {
      return
    }

    clearTimeout(searchDebounceTimeoutRef.current)
    searchDebounceTimeoutRef.current = null
  }

  const summary = useMemo(() => {
    return rows.reduce(
      (accumulator, row) => {
        accumulator.totalAmount += row.grandTotal

        if (row.postingStatus === "POSTED") {
          accumulator.posted += 1
        } else {
          accumulator.pendingPosting += 1
        }

        return accumulator
      },
      {
        pendingPosting: 0,
        posted: 0,
        totalAmount: 0,
      }
    )
  }, [rows])

  const loadPage = (params: {
    page: number
    pageSize: number
    search: string
    status: EmployeePortalMaterialRequestReceivingReportStatusFilter
    departmentId: string
  }) => {
    const nextToken = loadTokenRef.current + 1
    loadTokenRef.current = nextToken

    startListTransition(async () => {
      const response = await getMaterialRequestReceivingReportPageAction({
        companyId,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        status: params.status,
        departmentId: params.departmentId === "ALL" ? undefined : params.departmentId,
      })

      if (loadTokenRef.current !== nextToken) {
        return
      }

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      setRows(response.data.rows)
      setTotal(response.data.total)
      setPage(response.data.page)
      setPageSize(String(response.data.pageSize))
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Receiving Workspace</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Material Request Receiving Reports</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {canViewCompanyWide
            ? "Showing acknowledged receiving reports across the active company."
            : "Showing receiving reports for your own material requests."}
        </p>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Pending Posting</p>
              <IconChecklist className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">{summary.pendingPosting}</span>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Posted</p>
              <IconFileCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">{summary.posted}</span>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">Page Amount</p>
              <IconReceipt2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground">PHP {currency.format(summary.totalAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-[360px] sm:flex-none">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  const nextSearch = event.target.value
                  setSearch(nextSearch)
                  clearSearchDebounceTimeout()
                  searchDebounceTimeoutRef.current = setTimeout(() => {
                    loadPage({
                      page: 1,
                      pageSize: Number(pageSize),
                      search: nextSearch,
                      status,
                      departmentId,
                    })
                  }, SEARCH_DEBOUNCE_MS)
                }}
                placeholder="Search report #, request #, requester, department"
                className="rounded-lg pl-8"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return
                  }

                  event.preventDefault()
                  clearSearchDebounceTimeout()
                  loadPage({
                    page: 1,
                    pageSize: Number(pageSize),
                    search,
                    status,
                    departmentId,
                  })
                }}
              />
            </div>

            <Select
              value={status}
              onValueChange={(value) => {
                const nextStatus = value as EmployeePortalMaterialRequestReceivingReportStatusFilter
                setStatus(nextStatus)
                clearSearchDebounceTimeout()
                loadPage({
                  page: 1,
                  pageSize: Number(pageSize),
                  search,
                  status: nextStatus,
                  departmentId,
                })
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING_POSTING">Pending Posting</SelectItem>
                <SelectItem value="POSTED">Posted</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={departmentId}
              onValueChange={(value) => {
                setDepartmentId(value)
                clearSearchDebounceTimeout()
                loadPage({
                  page: 1,
                  pageSize: Number(pageSize),
                  search,
                  status,
                  departmentId: value,
                })
              }}
            >
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departmentOptions.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearSearchDebounceTimeout()
                setSearch("")
                setStatus("ALL")
                setDepartmentId("ALL")
                loadPage({
                  page: 1,
                  pageSize: Number(pageSize),
                  search: "",
                  status: "ALL",
                  departmentId: "ALL",
                })
              }}
            >
              <IconFilterOff className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          <div className="overflow-hidden border border-border/60 bg-card">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/30">
                  <tr>
                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Receiving Report</th>
                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Request</th>
                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requester</th>
                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Department</th>
                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Received</th>
                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posting</th>
                    <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                    <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                        No receiving reports found for the current filters.
                      </td>
                    </tr>
                  ) : null}

                  {rows.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                      className="group"
                    >
                      <td className="border-y border-l border-border/60 bg-background px-3 py-3 transition-colors group-hover:bg-muted/20">
                        <p className="font-medium text-foreground">{row.reportNumber}</p>
                        <p className="text-xs text-muted-foreground">{row.itemCount} item(s)</p>
                      </td>
                      <td className="border-y border-border/60 bg-background px-3 py-3 transition-colors group-hover:bg-muted/20">
                        <p className="font-medium text-foreground">{row.requestNumber}</p>
                        <p className="text-xs text-muted-foreground">{row.datePreparedLabel} - {row.dateRequiredLabel}</p>
                      </td>
                      <td className="border-y border-border/60 bg-background px-3 py-3 transition-colors group-hover:bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0 rounded-md border border-border/60 after:rounded-md">
                            <AvatarImage
                              src={row.requesterPhotoUrl ?? undefined}
                              alt={row.requesterName}
                              className="!rounded-md object-cover"
                            />
                            <AvatarFallback className="!rounded-md bg-primary/5 text-[10px] font-semibold text-primary">
                              {getNameInitials(row.requesterName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm text-foreground">{row.requesterName}</p>
                            <p className="text-xs text-muted-foreground">{row.requesterEmployeeNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="border-y border-border/60 bg-background px-3 py-3 text-foreground transition-colors group-hover:bg-muted/20">
                        {row.departmentName}
                      </td>
                      <td className="border-y border-border/60 bg-background px-3 py-3 transition-colors group-hover:bg-muted/20">
                        <p className="text-sm text-foreground">{row.receivedAtLabel}</p>
                        <p className="text-xs text-muted-foreground">By {row.receivedByName}</p>
                      </td>
                      <td className="border-y border-border/60 bg-background px-3 py-3 transition-colors group-hover:bg-muted/20">
                        <Badge variant={postingStatusVariant(row.postingStatus)} className="rounded-full border px-2 py-0.5 text-[10px]">
                          {postingStatusLabel(row.postingStatus)}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{row.postingReference ?? "-"}</p>
                      </td>
                      <td className="border-y border-border/60 bg-background px-3 py-3 text-right font-medium text-foreground transition-colors group-hover:bg-muted/20">
                        PHP {currency.format(row.grandTotal)}
                      </td>
                      <td className="border-y border-r border-border/60 bg-background px-3 py-3 text-right transition-colors group-hover:bg-muted/20">
                        <div className="flex justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button type="button" size="icon" className="h-8 w-8 rounded-md" asChild>
                                <Link href={`/${companyId}/employee-portal/material-request-receiving-reports/${row.id}`}>
                                  <IconExternalLink className="h-3.5 w-3.5" />
                                  <span className="sr-only">View Receiving Report</span>
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={6}>
                              View Receiving Report
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/60 px-3 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing <span className="font-medium text-foreground">{rows.length}</span> of{" "}
                <span className="font-medium text-foreground">{total}</span> report(s)
              </p>

              <div className="flex items-center gap-2">
                <Select
                  value={pageSize}
                  onValueChange={(value) => {
                    setPageSize(value)
                    clearSearchDebounceTimeout()
                    loadPage({
                      page: 1,
                      pageSize: Number(value),
                      search,
                      status,
                      departmentId,
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-[86px] rounded-md text-xs">
                    <SelectValue placeholder="Rows" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isListPending || page <= 1}
                  onClick={() =>
                    loadPage({
                      page: page - 1,
                      pageSize: Number(pageSize),
                      search,
                      status,
                      departmentId,
                    })
                  }
                >
                  Prev
                </Button>
                <span>
                  Page <span className="font-medium text-foreground">{page}</span> of{" "}
                  <span className="font-medium text-foreground">{totalPages}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isListPending || page >= totalPages}
                  onClick={() =>
                    loadPage({
                      page: page + 1,
                      pageSize: Number(pageSize),
                      search,
                      status,
                      departmentId,
                    })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
