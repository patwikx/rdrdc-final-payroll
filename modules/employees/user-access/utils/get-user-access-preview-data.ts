import { db } from "@/lib/db"

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

export type UserAccessPreviewData = {
  rows: UserAccessPreviewRow[]
  availableUsers: AvailableSystemUserOption[]
  systemUsers: SystemUserAccountRow[]
}

export async function getUserAccessPreviewData(companyId: string): Promise<UserAccessPreviewData> {
  const [employees, users, companyUsers] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
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
      take: 80,
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
      take: 100,
    }),
    db.userCompanyAccess.findMany({
      where: {
        companyId,
      },
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
      take: 300,
    }),
  ])

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
  }
}
