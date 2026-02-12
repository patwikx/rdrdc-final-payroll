import { db } from "@/lib/db"

const DEFAULT_EMPLOYEE_PAGE_SIZE = 10
const DEFAULT_SYSTEM_USER_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

export type UserAccessLinkFilter = "ALL" | "LINKED" | "UNLINKED"

export type UserAccessPreviewRow = {
  employeeId: string
  employeeNumber: string
  fullName: string
  photoUrl: string | null
  department: string
  position: string
  hasLinkedUser: boolean
  linkedUserId: string | null
  linkedUsername: string | null
  linkedEmail: string | null
  linkedUserActive: boolean
  linkedCompanyRole: string | null
  requestApprover: boolean
}

export type AvailableSystemUserOption = {
  id: string
  username: string
  email: string
  displayName: string
  companyRole: string | null
}

export type SystemUserAccountRow = {
  id: string
  username: string
  email: string
  displayName: string
  companyRole: string
  isActive: boolean
  isRequestApprover: boolean
  isLinked: boolean
  linkedEmployeeNumber: string | null
  linkedEmployeeName: string | null
}

export type UserAccessPreviewQuery = {
  query?: string
  employeePage?: number
  employeePageSize?: number
  employeeLinkFilter?: UserAccessLinkFilter
  systemUserPage?: number
  systemUserPageSize?: number
  systemLinkFilter?: UserAccessLinkFilter
}

export type UserAccessPreviewData = {
  rows: UserAccessPreviewRow[]
  availableUsers: AvailableSystemUserOption[]
  systemUsers: SystemUserAccountRow[]
  query: string
  employeeLinkFilter: UserAccessLinkFilter
  systemLinkFilter: UserAccessLinkFilter
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
}

const normalizePage = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return 1
  const parsed = Math.floor(value as number)
  return parsed > 0 ? parsed : 1
}

const normalizePageSize = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback
  const parsed = Math.floor(value as number)
  if (parsed < 1) return fallback
  return Math.min(parsed, MAX_PAGE_SIZE)
}

const normalizeLinkFilter = (value: UserAccessPreviewQuery["employeeLinkFilter"]): UserAccessLinkFilter => {
  if (value === "LINKED" || value === "UNLINKED") {
    return value
  }
  return "ALL"
}

export async function getUserAccessPreviewData(
  companyId: string,
  options: UserAccessPreviewQuery = {}
): Promise<UserAccessPreviewData> {
  const normalizedQuery = options.query?.trim() ?? ""
  const employeePage = normalizePage(options.employeePage)
  const employeePageSize = normalizePageSize(options.employeePageSize, DEFAULT_EMPLOYEE_PAGE_SIZE)
  const systemUserPage = normalizePage(options.systemUserPage)
  const systemUserPageSize = normalizePageSize(options.systemUserPageSize, DEFAULT_SYSTEM_USER_PAGE_SIZE)
  const employeeLinkFilter = normalizeLinkFilter(options.employeeLinkFilter)
  const systemLinkFilter = normalizeLinkFilter(options.systemLinkFilter)

  const employeeWhere = {
    companyId,
    deletedAt: null,
    ...(employeeLinkFilter === "LINKED" ? { user: { isNot: null } } : {}),
    ...(employeeLinkFilter === "UNLINKED" ? { user: null } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            { employeeNumber: { contains: normalizedQuery, mode: "insensitive" as const } },
            { firstName: { contains: normalizedQuery, mode: "insensitive" as const } },
            { lastName: { contains: normalizedQuery, mode: "insensitive" as const } },
            { department: { is: { name: { contains: normalizedQuery, mode: "insensitive" as const } } } },
            { position: { is: { name: { contains: normalizedQuery, mode: "insensitive" as const } } } },
            { user: { is: { username: { contains: normalizedQuery, mode: "insensitive" as const } } } },
            { user: { is: { email: { contains: normalizedQuery, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  }

  const systemUserWhere = {
    companyId,
    ...(systemLinkFilter === "LINKED" ? { user: { employee: { isNot: null } } } : {}),
    ...(systemLinkFilter === "UNLINKED" ? { user: { employee: null } } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            { user: { username: { contains: normalizedQuery, mode: "insensitive" as const } } },
            { user: { email: { contains: normalizedQuery, mode: "insensitive" as const } } },
            { user: { firstName: { contains: normalizedQuery, mode: "insensitive" as const } } },
            { user: { lastName: { contains: normalizedQuery, mode: "insensitive" as const } } },
            { user: { employee: { is: { employeeNumber: { contains: normalizedQuery, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  }

  const [employeeTotalItems, systemUserTotalItems, employees, users, companyUsers] = await Promise.all([
    db.employee.count({
      where: employeeWhere,
    }),
    db.userCompanyAccess.count({
      where: systemUserWhere,
    }),
    db.employee.findMany({
      where: employeeWhere,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
            isRequestApprover: true,
            companyAccess: {
              where: {
                companyId,
                isActive: true,
              },
              select: {
                role: true,
              },
              take: 1,
            },
          },
        },
      },
      skip: (employeePage - 1) * employeePageSize,
      take: employeePageSize,
    }),
    db.user.findMany({
      where: {
        isActive: true,
        employee: null,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        companyAccess: {
          where: {
            companyId,
            isActive: true,
          },
          select: {
            role: true,
          },
          take: 1,
        },
      },
    }),
    db.userCompanyAccess.findMany({
      where: systemUserWhere,
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      select: {
        role: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
            isRequestApprover: true,
            employee: {
              select: {
                employeeNumber: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      skip: (systemUserPage - 1) * systemUserPageSize,
      take: systemUserPageSize,
    }),
  ])

  const employeeTotalPages = Math.max(1, Math.ceil(employeeTotalItems / employeePageSize))
  const systemUserTotalPages = Math.max(1, Math.ceil(systemUserTotalItems / systemUserPageSize))

  const rows: UserAccessPreviewRow[] = employees.map((employee) => ({
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    fullName: `${employee.lastName}, ${employee.firstName}`,
    photoUrl: employee.photoUrl,
    department: employee.department?.name ?? "Unassigned",
    position: employee.position?.name ?? "Unassigned",
    hasLinkedUser: Boolean(employee.user?.id),
    linkedUserId: employee.user?.id ?? null,
    linkedUsername: employee.user?.username ?? null,
    linkedEmail: employee.user?.email ?? null,
    linkedUserActive: employee.user?.isActive ?? false,
    linkedCompanyRole: employee.user?.companyAccess[0]?.role ?? null,
    requestApprover: employee.user?.isRequestApprover ?? false,
  }))

  const availableUsers: AvailableSystemUserOption[] = users.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: `${user.lastName}, ${user.firstName}`,
    companyRole: user.companyAccess[0]?.role ?? null,
  }))

  const systemUsers: SystemUserAccountRow[] = companyUsers.map((record) => ({
    id: record.user.id,
    username: record.user.username,
    email: record.user.email,
    displayName: `${record.user.lastName}, ${record.user.firstName}`,
    companyRole: record.role,
    isActive: record.user.isActive,
    isRequestApprover: record.user.isRequestApprover,
    isLinked: Boolean(record.user.employee?.employeeNumber),
    linkedEmployeeNumber: record.user.employee?.employeeNumber ?? null,
    linkedEmployeeName: record.user.employee
      ? `${record.user.employee.lastName}, ${record.user.employee.firstName}`
      : null,
  }))

  return {
    rows,
    availableUsers,
    systemUsers,
    query: normalizedQuery,
    employeeLinkFilter,
    systemLinkFilter,
    employeePagination: {
      page: Math.min(employeePage, employeeTotalPages),
      pageSize: employeePageSize,
      totalItems: employeeTotalItems,
      totalPages: employeeTotalPages,
    },
    systemUserPagination: {
      page: Math.min(systemUserPage, systemUserTotalPages),
      pageSize: systemUserPageSize,
      totalItems: systemUserTotalItems,
      totalPages: systemUserTotalPages,
    },
  }
}
