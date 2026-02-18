import { NextRequest } from "next/server"

import { db } from "@/lib/db"
import { getUserCompanyOptions } from "@/modules/auth/utils/active-company-context"
import { COMPANY_ROLES, hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { getUserSessionForCompany } from "@/modules/auth/utils/credentials-auth"
import { getBearerToken, mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { verifyMobileAccessToken } from "@/modules/auth/utils/mobile-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const privilegedRoles = new Set<CompanyRole>(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN", "APPROVER"])
const processingRoles = new Set<CompanyRole>(["COMPANY_ADMIN", "HR_ADMIN", "PAYROLL_ADMIN"])
const postingRoles = new Set<CompanyRole>(["COMPANY_ADMIN", "PAYROLL_ADMIN"])

const isCompanyRole = (value: string | null | undefined): value is CompanyRole => {
  if (!value) return false
  return COMPANY_ROLES.includes(value as CompanyRole)
}

const resolveCompanyRole = (role: string | null | undefined, isAdmin: boolean): CompanyRole => {
  if (isCompanyRole(role)) {
    return role
  }
  if (isAdmin) {
    return "COMPANY_ADMIN"
  }
  return "EMPLOYEE"
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request.headers.get("authorization"))
  if (!token) {
    return mobileError("Missing bearer token.", 401)
  }

  const claims = verifyMobileAccessToken(token)
  if (!claims) {
    return mobileError("Invalid or expired access token.", 401)
  }

  const user = await getUserSessionForCompany({
    userId: claims.sub,
    companyId: claims.companyId,
  })
  if (!user) {
    return mobileError("Session is no longer valid.", 401)
  }

  const companyRole = resolveCompanyRole(user.companyRole, user.isAdmin)

  const [company, companies, employeeRecord] = await Promise.all([
    db.company.findFirst({
      where: {
        id: user.companyId ?? claims.companyId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        logoUrl: true,
      },
    }),
    getUserCompanyOptions(user.id),
    db.employee.findFirst({
      where: {
        userId: user.id,
        companyId: user.companyId ?? claims.companyId,
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
        user: {
          select: {
            isRequestApprover: true,
            companyAccess: {
              where: {
                companyId: user.companyId ?? claims.companyId,
                isActive: true,
              },
              select: {
                isMaterialRequestPurchaser: true,
                isMaterialRequestPoster: true,
              },
              take: 1,
            },
          },
        },
      },
    }),
  ])

  if (!company) {
    return mobileError("Company context is no longer available.", 404)
  }

  const employee = employeeRecord
    ? {
        id: employeeRecord.id,
        employeeNumber: employeeRecord.employeeNumber,
        firstName: employeeRecord.firstName,
        lastName: employeeRecord.lastName,
        hireDate: employeeRecord.hireDate,
        regularizationDate: employeeRecord.regularizationDate,
        departmentName: employeeRecord.department?.name ?? null,
        positionName: employeeRecord.position?.name ?? null,
        employmentStatusName: employeeRecord.employmentStatus?.name ?? null,
        employmentTypeName: employeeRecord.employmentType?.name ?? null,
        isRequestApprover: employeeRecord.user?.isRequestApprover ?? false,
        isMaterialRequestPurchaser:
          employeeRecord.user?.companyAccess[0]?.isMaterialRequestPurchaser ?? false,
        isMaterialRequestPoster:
          employeeRecord.user?.companyAccess[0]?.isMaterialRequestPoster ?? false,
      }
    : null

  const materialApprovalsEnabled =
    (employee?.isRequestApprover ?? false) || privilegedRoles.has(companyRole)
  const materialProcessingEnabled =
    (employee?.isMaterialRequestPurchaser ?? false) || processingRoles.has(companyRole)
  const materialPostingEnabled =
    (employee?.isMaterialRequestPoster ?? false) || postingRoles.has(companyRole)

  return mobileOk({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isAdmin: user.isAdmin,
      companyRole,
      employeeId: user.employeeId,
      employeeNumber: user.employeeNumber,
    },
    company: {
      id: company.id,
      code: company.code,
      name: company.name,
      logoUrl: company.logoUrl,
    },
    companies,
    employee,
    modules: {
      dashboard: true,
      profile: true,
      leaves: hasModuleAccess(companyRole, "leave"),
      overtime: hasModuleAccess(companyRole, "overtime"),
      payslips: true,
      materialRequests: true,
      materialApprovals: materialApprovalsEnabled,
      materialProcessing: materialProcessingEnabled,
      materialPosting: materialPostingEnabled,
    },
    token: {
      issuedAt: claims.iat,
      expiresAt: claims.exp,
    },
  })
}
