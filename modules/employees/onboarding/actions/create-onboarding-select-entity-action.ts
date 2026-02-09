"use server"

import { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import { z } from "zod"

const inputSchema = z.object({
  companyId: z.string().uuid(),
  entity: z.enum([
    "employmentStatus",
    "employmentType",
    "employmentClass",
    "department",
    "division",
    "position",
    "rank",
    "branch",
  ]),
  name: z.string().trim().min(2).max(120),
})

type CreateOnboardingSelectEntityInput = z.infer<typeof inputSchema>

type ActionResult =
  | { ok: true; option: { id: string; code: string; name: string } }
  | { ok: false; error: string }

const toCode = (name: string): string =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)

export async function createOnboardingSelectEntityAction(
  input: CreateOnboardingSelectEntityInput
): Promise<ActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid create request." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to manage onboarding references." }
  }

  try {
    const option = await db.$transaction(async (tx) => {
      const code = toCode(payload.name)

      if (payload.entity === "employmentStatus") {
        const currentMax = await tx.employmentStatus.aggregate({
          where: { companyId: context.companyId },
          _max: { displayOrder: true },
        })

        const row = await tx.employmentStatus.upsert({
          where: { companyId_code: { companyId: context.companyId, code } },
          update: { name: payload.name, isActive: true, updatedById: context.userId },
          create: {
            companyId: context.companyId,
            code,
            name: payload.name,
            allowsPayroll: true,
            allowsLeave: true,
            allowsLoans: true,
            triggersOffboarding: false,
            isActive: true,
            displayOrder: (currentMax._max?.displayOrder ?? 0) + 1,
            createdById: context.userId,
            updatedById: context.userId,
          },
          select: { id: true, code: true, name: true },
        })
        return row
      }

      if (payload.entity === "employmentType") {
        const currentMax = await tx.employmentType.aggregate({
          where: { companyId: context.companyId },
          _max: { displayOrder: true },
        })

        const row = await tx.employmentType.upsert({
          where: { companyId_code: { companyId: context.companyId, code } },
          update: { name: payload.name, isActive: true, updatedById: context.userId },
          create: {
            companyId: context.companyId,
            code,
            name: payload.name,
            hasBenefits: true,
            hasLeaveCredits: true,
            has13thMonth: true,
            hasMandatoryDeductions: true,
            isActive: true,
            displayOrder: (currentMax._max?.displayOrder ?? 0) + 1,
            createdById: context.userId,
            updatedById: context.userId,
          },
          select: { id: true, code: true, name: true },
        })
        return row
      }

      if (payload.entity === "employmentClass") {
        const currentMax = await tx.employmentClass.aggregate({
          where: { companyId: context.companyId },
          _max: { displayOrder: true },
        })

        const row = await tx.employmentClass.upsert({
          where: { companyId_code: { companyId: context.companyId, code } },
          update: { name: payload.name, isActive: true, updatedById: context.userId },
          create: {
            companyId: context.companyId,
            code,
            name: payload.name,
            standardHoursPerDay: "8.00",
            standardDaysPerWeek: 5,
            isOvertimeEligible: true,
            isHolidayPayEligible: true,
            isActive: true,
            displayOrder: (currentMax._max?.displayOrder ?? 0) + 1,
            createdById: context.userId,
            updatedById: context.userId,
          },
          select: { id: true, code: true, name: true },
        })
        return row
      }

      if (payload.entity === "department") {
        const currentMax = await tx.department.aggregate({
          where: { companyId: context.companyId },
          _max: { displayOrder: true },
        })

        const row = await tx.department.upsert({
          where: { companyId_code: { companyId: context.companyId, code } },
          update: { name: payload.name, isActive: true, updatedById: context.userId },
          create: {
            companyId: context.companyId,
            code,
            name: payload.name,
            isActive: true,
            displayOrder: (currentMax._max?.displayOrder ?? 0) + 1,
            createdById: context.userId,
            updatedById: context.userId,
          },
          select: { id: true, code: true, name: true },
        })
        return row
      }

      if (payload.entity === "division") {
        const currentMax = await tx.division.aggregate({
          where: { companyId: context.companyId },
          _max: { displayOrder: true },
        })

        const row = await tx.division.upsert({
          where: { companyId_code: { companyId: context.companyId, code } },
          update: { name: payload.name, isActive: true, updatedById: context.userId },
          create: {
            companyId: context.companyId,
            code,
            name: payload.name,
            isActive: true,
            displayOrder: (currentMax._max?.displayOrder ?? 0) + 1,
            createdById: context.userId,
            updatedById: context.userId,
          },
          select: { id: true, code: true, name: true },
        })
        return row
      }

      if (payload.entity === "position") {
        const currentMax = await tx.position.aggregate({
          where: { companyId: context.companyId },
          _max: { displayOrder: true },
        })

        const row = await tx.position.upsert({
          where: { companyId_code: { companyId: context.companyId, code } },
          update: { name: payload.name, isActive: true, updatedById: context.userId },
          create: {
            companyId: context.companyId,
            code,
            name: payload.name,
            level: 1,
            isActive: true,
            displayOrder: (currentMax._max?.displayOrder ?? 0) + 1,
            createdById: context.userId,
            updatedById: context.userId,
          },
          select: { id: true, code: true, name: true },
        })
        return row
      }

      if (payload.entity === "rank") {
        const [currentMaxOrder, currentMaxLevel] = await Promise.all([
          tx.rank.aggregate({ where: { companyId: context.companyId }, _max: { displayOrder: true } }),
          tx.rank.aggregate({ where: { companyId: context.companyId }, _max: { level: true } }),
        ])

        const row = await tx.rank.upsert({
          where: { companyId_code: { companyId: context.companyId, code } },
          update: { name: payload.name, isActive: true, updatedById: context.userId },
          create: {
            companyId: context.companyId,
            code,
            name: payload.name,
            level: (currentMaxLevel._max?.level ?? 0) + 1,
            isActive: true,
            displayOrder: (currentMaxOrder._max?.displayOrder ?? 0) + 1,
            createdById: context.userId,
            updatedById: context.userId,
          },
          select: { id: true, code: true, name: true },
        })
        return row
      }

      const currentMax = await tx.branch.aggregate({
        where: { companyId: context.companyId },
        _max: { displayOrder: true },
      })

      const row = await tx.branch.upsert({
        where: { companyId_code: { companyId: context.companyId, code } },
        update: { name: payload.name, isActive: true, updatedById: context.userId },
        create: {
          companyId: context.companyId,
          code,
          name: payload.name,
          country: "Philippines",
          isActive: true,
          displayOrder: (currentMax._max?.displayOrder ?? 0) + 1,
          createdById: context.userId,
          updatedById: context.userId,
        },
        select: { id: true, code: true, name: true },
      })

      return row
    })

    await createAuditLog({
      tableName: "OnboardingSelectEntity",
      recordId: option.id,
      action: "CREATE",
      userId: context.userId,
      reason: `ONBOARDING_${payload.entity.toUpperCase()}_CREATE`,
      changes: [
        { fieldName: "entity", newValue: payload.entity },
        { fieldName: "code", newValue: option.code },
        { fieldName: "name", newValue: option.name },
      ],
    })

    return { ok: true, option }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A record with the same generated code already exists. Try a different name." }
    }

    return { ok: false, error: "Unable to create record right now. Please try again." }
  }
}
