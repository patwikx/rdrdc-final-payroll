import type { EmployeePortalLeaveApprovalHistoryRow } from "@/modules/leave/types/employee-portal-leave-types"
import { getEmployeePortalLeaveApprovalHistoryPageReadModel } from "@/modules/leave/utils/employee-portal-leave-read-models"
import type { EmployeePortalMaterialRequestApprovalHistoryRow } from "@/modules/material-requests/types/employee-portal-material-request-types"
import { getEmployeePortalMaterialRequestApprovalHistoryPageReadModel } from "@/modules/material-requests/utils/employee-portal-material-request-read-models"
import type { EmployeePortalOvertimeApprovalHistoryRow } from "@/modules/overtime/types/overtime-domain-types"
import { getEmployeePortalOvertimeApprovalHistoryPageReadModel } from "@/modules/overtime/utils/overtime-domain"
import type { PurchaseRequestApprovalHistoryRow } from "@/modules/procurement/types/purchase-request-types"
import { getPurchaseRequestApprovalHistoryPageReadModel } from "@/modules/procurement/utils/purchase-request-read-models"

export type ConsolidatedApprovalTypeFilter = "ALL" | "LEAVE" | "OVERTIME" | "MATERIAL" | "PURCHASE"
export type ConsolidatedApprovalStatusFilter =
  | "ALL"
  | "APPROVED"
  | "REJECTED"
  | "SUPERVISOR_APPROVED"
  | "PENDING_APPROVAL"
  | "CANCELLED"

export type EmployeePortalConsolidatedApprovalHistoryItem = {
  id: string
  approvalType: "LEAVE" | "OVERTIME" | "MATERIAL" | "PURCHASE"
  requestNumber: string
  employeeName: string
  employeeNumber: string
  photoUrl: string | null
  departmentName: string
  statusCode: string
  decidedAtIso: string
  decidedAtLabel: string
  summaryPrimary: string
  summarySecondary: string
  note: string
  requestHref: string
}

export type EmployeePortalConsolidatedApprovalHistoryStats = {
  total: number
  leave: number
  overtime: number
  material: number
  purchase: number
}

export type EmployeePortalConsolidatedApprovalHistoryPage = {
  rows: EmployeePortalConsolidatedApprovalHistoryItem[]
  total: number
  page: number
  pageSize: number
  stats: EmployeePortalConsolidatedApprovalHistoryStats
  statusOptions: ConsolidatedApprovalStatusFilter[]
}

type LeaveOvertimeStatusFilter = "ALL" | "APPROVED" | "REJECTED" | "SUPERVISOR_APPROVED"
type MaterialStatusFilter = "ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED"

const LEAVE_OVERTIME_STATUS_OPTIONS: LeaveOvertimeStatusFilter[] = [
  "ALL",
  "APPROVED",
  "REJECTED",
  "SUPERVISOR_APPROVED",
]

const MATERIAL_STATUS_OPTIONS: MaterialStatusFilter[] = ["ALL", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"]

const ALL_STATUS_OPTIONS: ConsolidatedApprovalStatusFilter[] = [
  "ALL",
  "APPROVED",
  "REJECTED",
  "SUPERVISOR_APPROVED",
  "PENDING_APPROVAL",
  "CANCELLED",
]

const currency = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const isLeaveOvertimeStatus = (status: ConsolidatedApprovalStatusFilter): status is LeaveOvertimeStatusFilter => {
  return LEAVE_OVERTIME_STATUS_OPTIONS.includes(status as LeaveOvertimeStatusFilter)
}

const isMaterialStatus = (status: ConsolidatedApprovalStatusFilter): status is MaterialStatusFilter => {
  return MATERIAL_STATUS_OPTIONS.includes(status as MaterialStatusFilter)
}

const toLeaveItem = (
  companyId: string,
  row: EmployeePortalLeaveApprovalHistoryRow
): EmployeePortalConsolidatedApprovalHistoryItem => {
  return {
    id: `leave-${row.id}`,
    approvalType: "LEAVE",
    requestNumber: row.requestNumber,
    employeeName: row.employeeName,
    employeeNumber: row.employeeNumber,
    photoUrl: row.employeePhotoUrl,
    departmentName: row.departmentName,
    statusCode: row.statusCode,
    decidedAtIso: row.decidedAtIso,
    decidedAtLabel: row.decidedAtLabel,
    summaryPrimary: `${row.leaveTypeName} • ${row.numberOfDays} day(s)`,
    summarySecondary: `${row.startDate} to ${row.endDate}`,
    note: row.reason?.trim() ? row.reason : "No reason provided.",
    requestHref: `/${companyId}/employee-portal/approval-history/leave/${row.id}`,
  }
}

const toOvertimeItem = (
  companyId: string,
  row: EmployeePortalOvertimeApprovalHistoryRow
): EmployeePortalConsolidatedApprovalHistoryItem => {
  return {
    id: `overtime-${row.id}`,
    approvalType: "OVERTIME",
    requestNumber: row.requestNumber,
    employeeName: row.employeeName,
    employeeNumber: row.employeeNumber,
    photoUrl: row.employeePhotoUrl,
    departmentName: row.departmentName,
    statusCode: row.statusCode,
    decidedAtIso: row.decidedAtIso,
    decidedAtLabel: row.decidedAtLabel,
    summaryPrimary: `${row.overtimeDate} • ${row.hours.toFixed(2)} hour(s)`,
    summarySecondary: row.ctoConversionPreview ? "CTO 1:1 conversion eligible" : "Standard OT",
    note: row.reason?.trim() ? row.reason : "No reason provided.",
    requestHref: `/${companyId}/employee-portal/approval-history/overtime/${row.id}`,
  }
}

const toMaterialItem = (
  companyId: string,
  row: EmployeePortalMaterialRequestApprovalHistoryRow
): EmployeePortalConsolidatedApprovalHistoryItem => {
  return {
    id: `material-${row.id}`,
    approvalType: "MATERIAL",
    requestNumber: row.requestNumber,
    employeeName: row.requesterName,
    employeeNumber: row.requesterEmployeeNumber,
    photoUrl: row.requesterPhotoUrl,
    departmentName: row.departmentName,
    statusCode: row.status,
    decidedAtIso: row.actedAtIso,
    decidedAtLabel: row.actedAtLabel,
    summaryPrimary: `Prepared ${row.datePreparedLabel} • Required ${row.dateRequiredLabel}`,
    summarySecondary: `Amount PHP ${currency.format(row.grandTotal)}`,
    note: row.actedRemarks?.trim() || row.finalDecisionRemarks?.trim() || "No remarks.",
    requestHref: `/${companyId}/employee-portal/approval-history/material/${row.id}`,
  }
}

const toPurchaseItem = (
  companyId: string,
  row: PurchaseRequestApprovalHistoryRow
): EmployeePortalConsolidatedApprovalHistoryItem => {
  return {
    id: `purchase-${row.id}`,
    approvalType: "PURCHASE",
    requestNumber: row.requestNumber,
    employeeName: row.requesterName,
    employeeNumber: row.requesterEmployeeNumber,
    photoUrl: row.requesterPhotoUrl,
    departmentName: row.departmentName,
    statusCode: row.status,
    decidedAtIso: row.actedAtIso,
    decidedAtLabel: row.actedAtLabel,
    summaryPrimary: `Prepared ${row.datePreparedLabel} • Required ${row.dateRequiredLabel}`,
    summarySecondary: `Amount PHP ${currency.format(row.grandTotal)}`,
    note: row.actedRemarks?.trim() || row.finalDecisionRemarks?.trim() || "No remarks.",
    requestHref: `/${companyId}/employee-portal/purchase-requests/${row.id}`,
  }
}

export async function getEmployeePortalConsolidatedApprovalHistoryPageReadModel(params: {
  companyId: string
  approverUserId: string
  isHR: boolean
  page: number
  pageSize: number
  search: string
  type: ConsolidatedApprovalTypeFilter
  status: ConsolidatedApprovalStatusFilter
}): Promise<EmployeePortalConsolidatedApprovalHistoryPage> {
  const requestedPage = Math.max(1, params.page)
  const requestedPageSize = Math.max(1, params.pageSize)
  const isAllTypes = params.type === "ALL"
  const perTypePageSize = isAllTypes ? requestedPage * requestedPageSize : requestedPageSize
  const perTypePage = isAllTypes ? 1 : requestedPage

  const shouldQueryLeave = params.type === "ALL" || params.type === "LEAVE"
  const shouldQueryOvertime = params.type === "ALL" || params.type === "OVERTIME"
  const shouldQueryMaterial = params.type === "ALL" || params.type === "MATERIAL"
  const shouldQueryPurchase = params.type === "ALL" || params.type === "PURCHASE"

  const leavePromise = shouldQueryLeave
    ? isLeaveOvertimeStatus(params.status)
      ? getEmployeePortalLeaveApprovalHistoryPageReadModel({
          companyIds: [params.companyId],
          isHR: params.isHR,
          approverUserId: params.approverUserId,
          page: perTypePage,
          pageSize: perTypePageSize,
          search: params.search,
          status: params.status,
          filterCompanyId: undefined,
          fromDate: "",
          toDate: "",
          departmentId: undefined,
        })
      : Promise.resolve({ rows: [], total: 0, page: perTypePage, pageSize: perTypePageSize })
    : Promise.resolve({ rows: [], total: 0, page: perTypePage, pageSize: perTypePageSize })

  const overtimePromise = shouldQueryOvertime
    ? isLeaveOvertimeStatus(params.status)
      ? getEmployeePortalOvertimeApprovalHistoryPageReadModel({
          companyIds: [params.companyId],
          isHR: params.isHR,
          approverUserId: params.approverUserId,
          page: perTypePage,
          pageSize: perTypePageSize,
          search: params.search,
          status: params.status,
          filterCompanyId: undefined,
          departmentId: undefined,
          fromDate: "",
          toDate: "",
        })
      : Promise.resolve({ rows: [], total: 0, page: perTypePage, pageSize: perTypePageSize })
    : Promise.resolve({ rows: [], total: 0, page: perTypePage, pageSize: perTypePageSize })

  const materialPromise = shouldQueryMaterial
    ? isMaterialStatus(params.status)
      ? getEmployeePortalMaterialRequestApprovalHistoryPageReadModel({
          companyId: params.companyId,
          approverUserId: params.approverUserId,
          isHR: params.isHR,
          page: perTypePage,
          pageSize: perTypePageSize,
          search: params.search,
          status: params.status,
          departmentId: undefined,
        })
      : Promise.resolve({ rows: [], total: 0, page: perTypePage, pageSize: perTypePageSize })
    : Promise.resolve({ rows: [], total: 0, page: perTypePage, pageSize: perTypePageSize })

  const purchasePromise = shouldQueryPurchase
    ? isMaterialStatus(params.status)
      ? getPurchaseRequestApprovalHistoryPageReadModel({
          companyId: params.companyId,
          approverUserId: params.approverUserId,
          isHR: params.isHR,
          page: perTypePage,
          pageSize: perTypePageSize,
          search: params.search,
          status: params.status,
          departmentId: undefined,
        })
      : Promise.resolve({ rows: [], total: 0, page: perTypePage, pageSize: perTypePageSize })
    : Promise.resolve({ rows: [], total: 0, page: perTypePage, pageSize: perTypePageSize })

  const [leavePage, overtimePage, materialPage, purchasePage] = await Promise.all([
    leavePromise,
    overtimePromise,
    materialPromise,
    purchasePromise,
  ])

  const mappedLeaveRows = leavePage.rows.map((row) => toLeaveItem(params.companyId, row))
  const mappedOvertimeRows = overtimePage.rows.map((row) => toOvertimeItem(params.companyId, row))
  const mappedMaterialRows = materialPage.rows.map((row) => toMaterialItem(params.companyId, row))
  const mappedPurchaseRows = purchasePage.rows.map((row) => toPurchaseItem(params.companyId, row))

  const mergedRows = [...mappedLeaveRows, ...mappedOvertimeRows, ...mappedMaterialRows, ...mappedPurchaseRows].sort(
    (left, right) => right.decidedAtIso.localeCompare(left.decidedAtIso)
  )

  const rows = isAllTypes
    ? mergedRows.slice((requestedPage - 1) * requestedPageSize, requestedPage * requestedPageSize)
    : mergedRows

  const stats = {
    total: leavePage.total + overtimePage.total + materialPage.total + purchasePage.total,
    leave: leavePage.total,
    overtime: overtimePage.total,
    material: materialPage.total,
    purchase: purchasePage.total,
  }

  const statusOptions: ConsolidatedApprovalStatusFilter[] =
    params.type === "LEAVE" || params.type === "OVERTIME"
      ? LEAVE_OVERTIME_STATUS_OPTIONS
      : params.type === "MATERIAL" || params.type === "PURCHASE"
        ? MATERIAL_STATUS_OPTIONS
        : ALL_STATUS_OPTIONS

  return {
    rows,
    total: stats.total,
    page: requestedPage,
    pageSize: requestedPageSize,
    stats,
    statusOptions,
  }
}
