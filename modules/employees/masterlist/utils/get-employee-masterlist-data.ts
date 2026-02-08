import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

export type EmployeeMasterlistRow = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  fullName: string
  photoUrl: string | null
  email: string
  mobile: string
  branch: string
  department: string
  position: string
  employmentStatus: string
  hireDate: string
  monthlyRate: string
  isActive: boolean
}

export type EmployeeMasterlistViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  employees: EmployeeMasterlistRow[]
}

const toDateLabel = (value: Date | null | undefined): string => {
  if (!value) return "-"

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
}

export async function getEmployeeMasterlistViewModel(companyId: string): Promise<EmployeeMasterlistViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const employees = await db.employee.findMany({
    where: {
      companyId: context.companyId,
      deletedAt: null,
    },
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      photoUrl: true,
      hireDate: true,
      isActive: true,
      employmentStatus: { select: { name: true } },
      department: { select: { name: true } },
      branch: { select: { name: true } },
      position: { select: { name: true } },
      contacts: {
        where: { isActive: true },
        orderBy: { isPrimary: "desc" },
        select: { number: true },
        take: 1,
      },
      emails: {
        where: { isActive: true },
        orderBy: { isPrimary: "desc" },
        select: { email: true },
        take: 1,
      },
      salary: {
        select: { baseSalary: true },
      },
    },
  })

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    employees: employees.map((employee) => {
      const middleInitial = employee.middleName ? ` ${employee.middleName.charAt(0)}.` : ""
      const suffix = employee.suffix ? ` ${employee.suffix}` : ""

      return {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.lastName}, ${employee.firstName}${middleInitial}${suffix}`,
        photoUrl: employee.photoUrl,
        email: employee.emails[0]?.email ?? "-",
        mobile: employee.contacts[0]?.number ?? "-",
        branch: employee.branch?.name ?? "-",
        department: employee.department?.name ?? "-",
        position: employee.position?.name ?? "-",
        employmentStatus: employee.employmentStatus?.name ?? "-",
        hireDate: toDateLabel(employee.hireDate),
        monthlyRate: employee.salary?.baseSalary ? Number(employee.salary.baseSalary).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-",
        isActive: employee.isActive,
      }
    }),
  }
}
