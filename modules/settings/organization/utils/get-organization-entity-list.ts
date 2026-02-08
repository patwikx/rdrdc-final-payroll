import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

export type OrganizationEntityKey =
  | "departments"
  | "positions"
  | "branches"
  | "divisions"
  | "ranks"

export type OrganizationEntityRow = {
  id: string
  code: string
  name: string
  description: string | null
  secondary: string | null
  isActive: boolean
}

export type OrganizationEntityListViewModel = {
  companyId: string
  companyName: string
  entityLabel: string
  entityDescription: string
  rows: OrganizationEntityRow[]
}

const ENTITY_META: Record<OrganizationEntityKey, { label: string; description: string }> = {
  departments: {
    label: "Departments",
    description: "View all configured departments and their parent hierarchy.",
  },
  positions: {
    label: "Positions",
    description: "View all positions with level and job-grade context.",
  },
  branches: {
    label: "Branches",
    description: "View all branches and their location/contact details.",
  },
  divisions: {
    label: "Divisions",
    description: "View all divisions and division hierarchy records.",
  },
  ranks: {
    label: "Ranks",
    description: "View all ranks, levels, and rank categories.",
  },
}

const toSecondary = (...parts: Array<string | null | undefined>): string | null => {
  const cleaned = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part && part.length > 0))
  if (cleaned.length === 0) {
    return null
  }
  return cleaned.join(" | ")
}

export async function getOrganizationEntityList(
  companyId: string,
  entity: OrganizationEntityKey
): Promise<OrganizationEntityListViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    throw new Error("You do not have access to organization settings.")
  }

  const meta = ENTITY_META[entity]

  if (entity === "departments") {
    const rows = await db.department.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        parent: { select: { code: true, name: true } },
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    })

    return {
      companyId: context.companyId,
      companyName: context.companyName,
      entityLabel: meta.label,
      entityDescription: meta.description,
      rows: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        secondary: row.parent ? `Parent: ${row.parent.code} - ${row.parent.name}` : null,
        isActive: row.isActive,
      })),
    }
  }

  if (entity === "positions") {
    const rows = await db.position.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        level: true,
        jobFamily: true,
        jobGrade: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    })

    return {
      companyId: context.companyId,
      companyName: context.companyName,
      entityLabel: meta.label,
      entityDescription: meta.description,
      rows: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        secondary: toSecondary(`Level ${row.level}`, row.jobFamily ?? null, row.jobGrade ?? null),
        isActive: row.isActive,
      })),
    }
  }

  if (entity === "branches") {
    const rows = await db.branch.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        city: true,
        province: true,
        region: true,
        phone: true,
        email: true,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    })

    return {
      companyId: context.companyId,
      companyName: context.companyName,
      entityLabel: meta.label,
      entityDescription: meta.description,
      rows: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        secondary: toSecondary(row.city ?? null, row.province ?? null, row.region ?? null, row.phone ?? null, row.email ?? null),
        isActive: row.isActive,
      })),
    }
  }

  if (entity === "divisions") {
    const rows = await db.division.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        parent: { select: { code: true, name: true } },
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    })

    return {
      companyId: context.companyId,
      companyName: context.companyName,
      entityLabel: meta.label,
      entityDescription: meta.description,
      rows: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        secondary: row.parent ? `Parent: ${row.parent.code} - ${row.parent.name}` : null,
        isActive: row.isActive,
      })),
    }
  }

  const rows = await db.rank.findMany({
    where: { companyId: context.companyId },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      level: true,
      category: true,
      isActive: true,
    },
    orderBy: [{ level: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  })

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    entityLabel: meta.label,
    entityDescription: meta.description,
    rows: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      secondary: toSecondary(`Level ${row.level}`, row.category ?? null),
      isActive: row.isActive,
    })),
  }
}
