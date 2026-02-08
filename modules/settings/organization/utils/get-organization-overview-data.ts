import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

export type OrganizationOverviewData = {
  companyId: string
  companyName: string
  companyCode: string
  companyRole: string
  departments: Array<{
    id: string
    code: string
    name: string
    description: string | null
    parentId: string | null
    parentLabel: string | null
    displayOrder: number
    isActive: boolean
  }>
  divisions: Array<{
    id: string
    code: string
    name: string
    description: string | null
    parentId: string | null
    parentLabel: string | null
    displayOrder: number
    isActive: boolean
  }>
  ranks: Array<{
    id: string
    code: string
    name: string
    description: string | null
    level: number
    category: string | null
    parentId: string | null
    parentLabel: string | null
    salaryGradeMin: number | null
    salaryGradeMax: number | null
    displayOrder: number
    isActive: boolean
  }>
  branches: Array<{
    id: string
    code: string
    name: string
    description: string | null
    city: string | null
    province: string | null
    region: string | null
    country: string
    phone: string | null
    email: string | null
    minimumWageRegion: string | null
    displayOrder: number
    isActive: boolean
  }>
}

export async function getOrganizationOverviewData(companyId: string): Promise<OrganizationOverviewData> {
  const context = await getActiveCompanyContext({ companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    throw new Error("You do not have access to organization settings.")
  }

  const [departments, divisions, ranks, branches] = await Promise.all([
    db.department.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        parentId: true,
        parent: { select: { code: true, name: true } },
        displayOrder: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    db.division.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        parentId: true,
        parent: { select: { code: true, name: true } },
        displayOrder: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    db.rank.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        level: true,
        category: true,
        parentId: true,
        parent: { select: { code: true, name: true } },
        salaryGradeMin: true,
        salaryGradeMax: true,
        displayOrder: true,
        isActive: true,
      },
      orderBy: [{ level: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    }),
    db.branch.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        city: true,
        province: true,
        region: true,
        country: true,
        phone: true,
        email: true,
        minimumWageRegion: true,
        displayOrder: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ])

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    departments: departments.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      parentLabel: item.parent ? `${item.parent.code} - ${item.parent.name}` : null,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    })),
    divisions: divisions.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      parentLabel: item.parent ? `${item.parent.code} - ${item.parent.name}` : null,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    })),
    ranks: ranks.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      level: item.level,
      category: item.category,
      parentId: item.parentId,
      parentLabel: item.parent ? `${item.parent.code} - ${item.parent.name}` : null,
      salaryGradeMin: item.salaryGradeMin ? Number(item.salaryGradeMin) : null,
      salaryGradeMax: item.salaryGradeMax ? Number(item.salaryGradeMax) : null,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    })),
    branches: branches.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      city: item.city,
      province: item.province,
      region: item.region,
      country: item.country,
      phone: item.phone,
      email: item.email,
      minimumWageRegion: item.minimumWageRegion,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    })),
  }
}
