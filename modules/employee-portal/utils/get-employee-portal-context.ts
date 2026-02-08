import { auth } from "@/auth"
import { db } from "@/lib/db"
import { getActiveCompanyContext, getUserCompanyOptions } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"

export type EmployeePortalContext = {
  userId: string
  companyId: string
  companyName: string
  companyRole: CompanyRole
  companies: Awaited<ReturnType<typeof getUserCompanyOptions>>
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    lastName: string
    hireDate: Date
    regularizationDate: Date | null
    department: { name: string } | null
    position: { name: string } | null
    employmentStatus: { name: string } | null
    employmentType: { name: string } | null
    user: { email: string; isRequestApprover: boolean } | null
  } | null
}

export async function getEmployeePortalContext(companyId: string): Promise<EmployeePortalContext | null> {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const [activeCompany, companies] = await Promise.all([
    getActiveCompanyContext({ companyId }),
    getUserCompanyOptions(session.user.id),
  ])

  const employee = await db.employee.findFirst({
    where: {
      userId: session.user.id,
      companyId: activeCompany.companyId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      regularizationDate: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
      employmentStatus: { select: { name: true } },
      employmentType: { select: { name: true } },
      user: { select: { email: true, isRequestApprover: true } },
    },
  })

  return {
    userId: session.user.id,
    companyId: activeCompany.companyId,
    companyName: activeCompany.companyName,
    companyRole: activeCompany.companyRole as CompanyRole,
    companies,
    employee,
  }
}
