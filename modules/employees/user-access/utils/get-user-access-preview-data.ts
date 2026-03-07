import { db } from "@/lib/db"
import type { AccessScope } from "@/modules/auth/utils/authorization-policy"

const DEFAULT_EMPLOYEE_PAGE_SIZE = 10
const DEFAULT_SYSTEM_USER_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

export type UserAccessLinkFilter = "ALL" | "LINKED" | "UNLINKED"
export type UserAccessRoleFilter = "ALL" | "EMPLOYEE" | "HR_ADMIN" | "PAYROLL_ADMIN" | "COMPANY_ADMIN"
export type UserAccessPreviewScope = "ALL" | "EMPLOYEES" | "SYSTEM_USERS"

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
  linkedUserActive: boolean
  linkedCompanyRole: string | null
  requestApprover: boolean
  materialRequestPurchaser: boolean
  materialRequestPoster: boolean
  purchaseRequestItemManager: boolean
  linkedCompanyAccesses: Array<{
    companyId: string
    companyCode: string
    companyName: string
    role: string
    isDefault: boolean
    isMaterialRequestPurchaser: boolean
    isMaterialRequestPoster: boolean
    isPurchaseRequestItemManager: boolean
  }>
}

export type UserAccessCompanyOption = {
  companyId: string
  companyCode: string
  companyName: string
  enablePurchaseRequestWorkflow: boolean
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
  isMaterialRequestPurchaser: boolean
  isMaterialRequestPoster: boolean
  isPurchaseRequestItemManager: boolean
  isLinked: boolean
  linkedEmployeeId: string | null
  linkedEmployeeNumber: string | null
  linkedEmployeeName: string | null
  hasExternalRequesterProfile: boolean
  externalRequesterCode: string | null
  portalCapabilityOverrides: Array<{
    capability: string
    accessScope: AccessScope
  }>
  linkedCompanyAccesses: Array<{
    companyId: string
    companyCode: string
    companyName: string
    role: string
    isDefault: boolean
    isMaterialRequestPurchaser: boolean
    isMaterialRequestPoster: boolean
    isPurchaseRequestItemManager: boolean
  }>
}

export type UserAccessPreviewQuery = {
  query?: string
  scope?: UserAccessPreviewScope
  includeCompanyOptions?: boolean
  employeePage?: number
  employeePageSize?: number
  employeeLinkFilter?: UserAccessLinkFilter
  roleFilter?: UserAccessRoleFilter
  systemUserPage?: number
  systemUserPageSize?: number
  systemLinkFilter?: UserAccessLinkFilter
}

export type UserAccessPreviewData = {
  rows: UserAccessPreviewRow[]
  systemUsers: SystemUserAccountRow[]
  companyOptions: UserAccessCompanyOption[]
  query: string
  employeeLinkFilter: UserAccessLinkFilter
  systemLinkFilter: UserAccessLinkFilter
  roleFilter: UserAccessRoleFilter
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
  purchaseRequestWorkflowEnabled: boolean
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

const normalizeRoleFilter = (value: UserAccessPreviewQuery["roleFilter"]): UserAccessRoleFilter => {
  if (
    value === "EMPLOYEE" ||
    value === "HR_ADMIN" ||
    value === "PAYROLL_ADMIN" ||
    value === "COMPANY_ADMIN"
  ) {
    return value
  }
  return "ALL"
}

export async function getUserAccessPreviewData(
  companyId: string,
  options: UserAccessPreviewQuery = {}
): Promise<UserAccessPreviewData> {
  const normalizedQuery = options.query?.trim() ?? ""
  const scope = options.scope ?? "ALL"
  const shouldLoadEmployees = scope !== "SYSTEM_USERS"
  const shouldLoadSystemUsers = scope !== "EMPLOYEES"
  const shouldLoadCompanyOptions = options.includeCompanyOptions !== false
  const employeePage = normalizePage(options.employeePage)
  const employeePageSize = normalizePageSize(options.employeePageSize, DEFAULT_EMPLOYEE_PAGE_SIZE)
  const systemUserPage = normalizePage(options.systemUserPage)
  const systemUserPageSize = normalizePageSize(options.systemUserPageSize, DEFAULT_SYSTEM_USER_PAGE_SIZE)
  const employeeLinkFilter = normalizeLinkFilter(options.employeeLinkFilter)
  const systemLinkFilter = normalizeLinkFilter(options.systemLinkFilter)
  const roleFilter = normalizeRoleFilter(options.roleFilter)

  const employeeWhere = {
    companyId,
    deletedAt: null,
    ...(employeeLinkFilter === "LINKED" ? { user: { isNot: null } } : {}),
    ...(employeeLinkFilter === "UNLINKED" ? { user: null } : {}),
    ...(roleFilter !== "ALL"
      ? {
          user: {
            is: {
              companyAccess: {
                some: {
                  companyId,
                  isActive: true,
                  role: roleFilter,
                },
              },
            },
          },
        }
      : {}),
    ...(normalizedQuery
      ? {
          OR: [
            { employeeNumber: { contains: normalizedQuery, mode: "insensitive" as const } },
            { firstName: { contains: normalizedQuery, mode: "insensitive" as const } },
            { lastName: { contains: normalizedQuery, mode: "insensitive" as const } },
            { department: { is: { name: { contains: normalizedQuery, mode: "insensitive" as const } } } },
            { position: { is: { name: { contains: normalizedQuery, mode: "insensitive" as const } } } },
            { user: { is: { username: { contains: normalizedQuery, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  }

  const systemUserWhere = {
    companyId,
    ...(systemLinkFilter === "LINKED" ? { user: { employee: { isNot: null } } } : {}),
    ...(systemLinkFilter === "UNLINKED" ? { user: { employee: null } } : {}),
    ...(roleFilter !== "ALL" ? { role: roleFilter } : {}),
    ...(normalizedQuery
        ? {
            OR: [
              { user: { username: { contains: normalizedQuery, mode: "insensitive" as const } } },
              { user: { firstName: { contains: normalizedQuery, mode: "insensitive" as const } } },
              { user: { lastName: { contains: normalizedQuery, mode: "insensitive" as const } } },
            { user: { employee: { is: { employeeNumber: { contains: normalizedQuery, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  }

  const loadEmployeesPage = () =>
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
            isActive: true,
            isRequestApprover: true,
            companyAccess: {
              where: {
                isActive: true,
                company: {
                  isActive: true,
                },
              },
              select: {
                companyId: true,
                role: true,
                isDefault: true,
                isMaterialRequestPurchaser: true,
                isMaterialRequestPoster: true,
                isPurchaseRequestItemManager: true,
                company: {
                  select: {
                    code: true,
                    name: true,
                  },
                },
              },
            },
            employeePortalCapabilityOverrides: {
              where: {
                companyId,
              },
              select: {
                capability: true,
                accessScope: true,
              },
            },
          },
        },
      },
      skip: (employeePage - 1) * employeePageSize,
      take: employeePageSize,
    })

  const loadSystemUsersPage = () =>
    db.userCompanyAccess.findMany({
      where: systemUserWhere,
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      select: {
        role: true,
        isMaterialRequestPurchaser: true,
        isMaterialRequestPoster: true,
        isPurchaseRequestItemManager: true,
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
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
              },
            },
            companyAccess: {
              where: {
                isActive: true,
                company: {
                  isActive: true,
                },
              },
              select: {
                companyId: true,
                role: true,
                isDefault: true,
                isMaterialRequestPurchaser: true,
                isMaterialRequestPoster: true,
                isPurchaseRequestItemManager: true,
                company: {
                  select: {
                    code: true,
                    name: true,
                  },
                },
              },
            },
            employeePortalCapabilityOverrides: {
              where: {
                companyId,
              },
              select: {
                capability: true,
                accessScope: true,
              },
            },
            externalRequesterProfiles: {
              where: {
                companyId,
              },
              orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
              select: {
                requesterCode: true,
                isActive: true,
              },
              take: 1,
            },
          },
        },
      },
      skip: (systemUserPage - 1) * systemUserPageSize,
      take: systemUserPageSize,
    })

  const loadCompanyOptions = () =>
    db.company.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        enablePurchaseRequestWorkflow: true,
      },
    })

  const employeeTotalItemsPromise = shouldLoadEmployees
    ? db.employee.count({
        where: employeeWhere,
      })
    : Promise.resolve(0)

  const systemUserTotalItemsPromise = shouldLoadSystemUsers
    ? db.userCompanyAccess.count({
        where: systemUserWhere,
      })
    : Promise.resolve(0)

  const employeesPromise = shouldLoadEmployees
    ? loadEmployeesPage()
    : Promise.resolve([] as Awaited<ReturnType<typeof loadEmployeesPage>>)

  const companyUsersPromise = shouldLoadSystemUsers
    ? loadSystemUsersPage()
    : Promise.resolve([] as Awaited<ReturnType<typeof loadSystemUsersPage>>)

  const companyOptionsPromise = shouldLoadCompanyOptions
    ? loadCompanyOptions()
    : Promise.resolve([] as Awaited<ReturnType<typeof loadCompanyOptions>>)
  const companyFeaturePromise = db.company.findUnique({
    where: { id: companyId },
    select: { enablePurchaseRequestWorkflow: true },
  })

  const [employeeTotalItems, systemUserTotalItems, employees, companyUsers, companyOptions, companyFeature] = await Promise.all([
    employeeTotalItemsPromise,
    systemUserTotalItemsPromise,
    employeesPromise,
    companyUsersPromise,
    companyOptionsPromise,
    companyFeaturePromise,
  ])

  const employeeTotalPages = shouldLoadEmployees
    ? Math.max(1, Math.ceil(employeeTotalItems / employeePageSize))
    : 1
  const systemUserTotalPages = shouldLoadSystemUsers
    ? Math.max(1, Math.ceil(systemUserTotalItems / systemUserPageSize))
    : 1

  const rows: UserAccessPreviewRow[] = employees.map((employee) => ({
    // The first block is current-company scoped summary for table columns.
    ...(() => {
      const currentCompanyAccess = employee.user?.companyAccess.find((access) => access.companyId === companyId)
      return {
        linkedCompanyRole: currentCompanyAccess?.role ?? null,
        materialRequestPurchaser: currentCompanyAccess?.isMaterialRequestPurchaser ?? false,
        materialRequestPoster: currentCompanyAccess?.isMaterialRequestPoster ?? false,
        purchaseRequestItemManager: currentCompanyAccess?.isPurchaseRequestItemManager ?? false,
      }
    })(),
    employeeId: employee.id,
    employeeNumber: employee.employeeNumber,
    fullName: `${employee.lastName}, ${employee.firstName}`,
    photoUrl: employee.photoUrl,
    department: employee.department?.name ?? "Unassigned",
    position: employee.position?.name ?? "Unassigned",
    hasLinkedUser: Boolean(employee.user?.id),
    linkedUserId: employee.user?.id ?? null,
    linkedUsername: employee.user?.username ?? null,
    linkedUserActive: employee.user?.isActive ?? false,
    requestApprover: employee.user?.isRequestApprover ?? false,
    linkedCompanyAccesses: (employee.user?.companyAccess ?? []).map((access) => ({
      companyId: access.companyId,
      companyCode: access.company.code,
      companyName: access.company.name,
      role: access.role,
      isDefault: access.isDefault,
      isMaterialRequestPurchaser: access.isMaterialRequestPurchaser,
      isMaterialRequestPoster: access.isMaterialRequestPoster,
      isPurchaseRequestItemManager: access.isPurchaseRequestItemManager,
    })),
  }))

  const systemUsers: SystemUserAccountRow[] = companyUsers.map((record) => ({
    id: record.user.id,
    username: record.user.username,
    email: record.user.email,
    displayName: `${record.user.lastName}, ${record.user.firstName}`,
    companyRole: record.role,
    isActive: record.user.isActive,
    isRequestApprover: record.user.isRequestApprover,
    isMaterialRequestPurchaser: record.isMaterialRequestPurchaser,
    isMaterialRequestPoster: record.isMaterialRequestPoster,
    isPurchaseRequestItemManager: record.isPurchaseRequestItemManager,
    isLinked: Boolean(record.user.employee?.employeeNumber),
    linkedEmployeeId: record.user.employee?.id ?? null,
    linkedEmployeeNumber: record.user.employee?.employeeNumber ?? null,
    linkedEmployeeName: record.user.employee
      ? `${record.user.employee.lastName}, ${record.user.employee.firstName}`
      : null,
    hasExternalRequesterProfile: Boolean(record.user.externalRequesterProfiles[0]?.isActive),
    externalRequesterCode: record.user.externalRequesterProfiles[0]?.requesterCode ?? null,
    portalCapabilityOverrides: record.user.employeePortalCapabilityOverrides.map((override) => ({
      capability: override.capability,
      accessScope: override.accessScope,
    })),
    linkedCompanyAccesses: record.user.companyAccess.map((access) => ({
      companyId: access.companyId,
      companyCode: access.company.code,
      companyName: access.company.name,
      role: access.role,
      isDefault: access.isDefault,
      isMaterialRequestPurchaser: access.isMaterialRequestPurchaser,
      isMaterialRequestPoster: access.isMaterialRequestPoster,
      isPurchaseRequestItemManager: access.isPurchaseRequestItemManager,
    })),
  }))

  return {
    rows,
    systemUsers,
    companyOptions: companyOptions.map((company) => ({
      companyId: company.id,
      companyCode: company.code,
      companyName: company.name,
      enablePurchaseRequestWorkflow: Boolean(company.enablePurchaseRequestWorkflow),
    })),
    query: normalizedQuery,
    employeeLinkFilter,
    systemLinkFilter,
    roleFilter,
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
    purchaseRequestWorkflowEnabled: Boolean(companyFeature?.enablePurchaseRequestWorkflow),
  }
}
