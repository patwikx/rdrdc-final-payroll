import type { ReactNode } from "react"
import type { UserAccessPreviewRow, SystemUserAccountRow } from "@/modules/employees/user-access/utils/get-user-access-preview-data"

export type WorkspaceProps = {
  rows: UserAccessPreviewRow[]
  systemUsers: SystemUserAccountRow[]
  onCreate: (row: UserAccessPreviewRow) => void
  onLink: (row: UserAccessPreviewRow) => void
  onUnlink: (row: UserAccessPreviewRow) => void
  onEdit: (row: UserAccessPreviewRow) => void
  onCreateSystemAccount: () => void
  filtersToolbar?: ReactNode
  isPending: boolean
  employeePagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  systemUserPagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  onEmployeePageChange: (nextPage: number) => void
  onSystemUserPageChange: (nextPage: number) => void
}

export function getEmployeeInitials(fullName: string): string {
  const [lastNamePart = "", firstNamePart = ""] = fullName.split(",")
  const first = firstNamePart.trim().charAt(0)
  const last = lastNamePart.trim().charAt(0)
  return `${first}${last}`.toUpperCase() || "NA"
}
