import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { OrganizationSetupInput } from "@/modules/settings/organization/schemas/organization-setup-schema"

type Option = {
  id: string
  code: string
  name: string
}

export type OrganizationSetupViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  form: OrganizationSetupInput
  options: {
    departments: Option[]
    divisions: Option[]
    ranks: Option[]
  }
}

const toText = (value: string | null | undefined): string => value ?? ""

export async function getOrganizationSetupViewModel(companyId: string): Promise<OrganizationSetupViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const [department, position, branch, division, rank, departments, divisions, ranks] = await Promise.all([
    db.department.findFirst({ where: { companyId: context.companyId }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] }),
    db.position.findFirst({ where: { companyId: context.companyId }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] }),
    db.branch.findFirst({ where: { companyId: context.companyId }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] }),
    db.division.findFirst({ where: { companyId: context.companyId }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] }),
    db.rank.findFirst({ where: { companyId: context.companyId }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] }),
    db.department.findMany({
      where: { companyId: context.companyId },
      select: { id: true, code: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    db.division.findMany({
      where: { companyId: context.companyId },
      select: { id: true, code: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    db.rank.findMany({
      where: { companyId: context.companyId },
      select: { id: true, code: true, name: true },
      orderBy: [{ level: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    }),
  ])

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    options: {
      departments,
      divisions,
      ranks,
    },
    form: {
      companyId: context.companyId,
      department: {
        id: department?.id,
        code: department?.code ?? "DEPT_MAIN",
        name: department?.name ?? "Main Department",
        description: toText(department?.description),
        parentId: department?.parentId ?? "",
        displayOrder: department?.displayOrder ?? 1,
        isActive: department?.isActive ?? true,
      },
      position: {
        id: position?.id,
        code: position?.code ?? "POS_MAIN",
        name: position?.name ?? "Primary Position",
        description: toText(position?.description),
        jobFamily: toText(position?.jobFamily),
        jobGrade: toText(position?.jobGrade),
        salaryGradeMin: position?.salaryGradeMin ? Number(position.salaryGradeMin) : undefined,
        salaryGradeMax: position?.salaryGradeMax ? Number(position.salaryGradeMax) : undefined,
        level: position?.level ?? 1,
        minExperienceYears: position?.minExperienceYears ?? undefined,
        educationRequired: toText(position?.educationRequired),
        displayOrder: position?.displayOrder ?? 1,
        isActive: position?.isActive ?? true,
      },
      branch: {
        id: branch?.id,
        code: branch?.code ?? "BR_MAIN",
        name: branch?.name ?? "Main Branch",
        description: toText(branch?.description),
        street: toText(branch?.street),
        barangay: toText(branch?.barangay),
        city: toText(branch?.city),
        municipality: toText(branch?.municipality),
        province: toText(branch?.province),
        region: toText(branch?.region),
        postalCode: toText(branch?.postalCode),
        country: branch?.country ?? "Philippines",
        phone: toText(branch?.phone),
        email: toText(branch?.email),
        minimumWageRegion: toText(branch?.minimumWageRegion),
        displayOrder: branch?.displayOrder ?? 1,
        isActive: branch?.isActive ?? true,
      },
      division: {
        id: division?.id,
        code: division?.code ?? "DIV_MAIN",
        name: division?.name ?? "Main Division",
        description: toText(division?.description),
        parentId: division?.parentId ?? "",
        displayOrder: division?.displayOrder ?? 1,
        isActive: division?.isActive ?? true,
      },
      rank: {
        id: rank?.id,
        code: rank?.code ?? "RANK_MAIN",
        name: rank?.name ?? "Main Rank",
        description: toText(rank?.description),
        level: rank?.level ?? 1,
        category: toText(rank?.category),
        parentId: rank?.parentId ?? "",
        salaryGradeMin: rank?.salaryGradeMin ? Number(rank.salaryGradeMin) : undefined,
        salaryGradeMax: rank?.salaryGradeMax ? Number(rank.salaryGradeMax) : undefined,
        displayOrder: rank?.displayOrder ?? 1,
        isActive: rank?.isActive ?? true,
      },
    },
  }
}
