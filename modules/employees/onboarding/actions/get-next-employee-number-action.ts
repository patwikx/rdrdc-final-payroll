"use server"

import { z } from "zod"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

const inputSchema = z.object({
  companyId: z.string().uuid(),
  lastName: z.string().trim().min(1).max(120),
})

type GetNextEmployeeNumberInput = z.infer<typeof inputSchema>

type GetNextEmployeeNumberActionResult =
  | {
      ok: true
      employeeNumber: string
      prefix: string
      nextSequence: number
    }
  | { ok: false; error: string }

const getLastNameInitial = (lastName: string): string | null => {
  const normalized = lastName.trim().toUpperCase()
  const match = normalized.match(/[A-Z]/)
  return match ? match[0] : null
}

export async function getNextEmployeeNumberAction(
  input: GetNextEmployeeNumberInput
): Promise<GetNextEmployeeNumberActionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid employee number request." }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "employees")) {
    return { ok: false, error: "You do not have permission to generate employee numbers." }
  }

  const prefix = getLastNameInitial(payload.lastName)
  if (!prefix) {
    return { ok: false, error: "Last name must include at least one letter." }
  }

  const prefixPattern = new RegExp(`^${prefix}-(\\d+)$`)
  const existingRows = await db.employee.findMany({
    where: {
      companyId: context.companyId,
      employeeNumber: {
        startsWith: `${prefix}-`,
      },
    },
    select: {
      employeeNumber: true,
    },
  })

  let maxSequence = -1
  for (const row of existingRows) {
    const match = row.employeeNumber.toUpperCase().match(prefixPattern)
    if (!match) {
      continue
    }

    const parsedSequence = Number.parseInt(match[1] ?? "", 10)
    if (!Number.isFinite(parsedSequence)) {
      continue
    }

    if (parsedSequence > maxSequence) {
      maxSequence = parsedSequence
    }
  }

  const nextSequence = maxSequence + 1
  const employeeNumber = `${prefix}-${String(nextSequence).padStart(3, "0")}`

  return {
    ok: true,
    employeeNumber,
    prefix,
    nextSequence,
  }
}
