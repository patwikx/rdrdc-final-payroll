"use server"

import { z } from "zod"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const getSourceDepartmentsFromCompanyInputSchema = z
  .object({
    companyId: z.string().uuid(),
    sourceCompanyId: z.string().uuid(),
  })
  .refine((value) => value.companyId !== value.sourceCompanyId, {
    message: "Source company must be different from the target company.",
    path: ["sourceCompanyId"],
  })

type GetSourceDepartmentsFromCompanyInput = z.infer<typeof getSourceDepartmentsFromCompanyInputSchema>

type SourceDepartmentListItem = {
  id: string
  code: string
  name: string
  parentLabel: string | null
  isActive: boolean
}

type GetSourceDepartmentsFromCompanyActionResult =
  | {
      ok: true
      departments: SourceDepartmentListItem[]
    }
  | {
      ok: false
      error: string
    }

export async function getSourceDepartmentsFromCompanyAction(
  input: GetSourceDepartmentsFromCompanyInput
): Promise<GetSourceDepartmentsFromCompanyActionResult> {
  const parsed = getSourceDepartmentsFromCompanyInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid source payload at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid source payload.",
    }
  }

  const payload = parsed.data
  const targetContext = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(targetContext.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to organization settings." }
  }

  if (targetContext.companyId !== payload.companyId) {
    return { ok: false, error: "Target company context mismatch." }
  }

  const sourceContext = await getActiveCompanyContext({ companyId: payload.sourceCompanyId })

  if (!hasModuleAccess(sourceContext.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to source company settings." }
  }

  if (sourceContext.companyId !== payload.sourceCompanyId) {
    return { ok: false, error: "Source company context mismatch." }
  }

  try {
    const departments = await db.department.findMany({
      where: {
        companyId: sourceContext.companyId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        parent: {
          select: {
            code: true,
            name: true,
          },
        },
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    })

    return {
      ok: true,
      departments: departments.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        parentLabel: item.parent ? `${item.parent.code} - ${item.parent.name}` : null,
        isActive: item.isActive,
      })),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to load source departments: ${message}` }
  }
}
