"use server"

import { revalidatePath } from "next/cache"

import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  syncLegacyEmployeesInputSchema,
  type SyncLegacyEmployeesInput,
} from "@/modules/settings/employment/schemas/sync-legacy-employees-schema"
import { executeLegacyEmployeeSync } from "@/modules/settings/employment/utils/execute-legacy-employee-sync"

type SyncLegacyEmployeesActionResult =
  | {
      ok: true
      message: string
      dryRun: boolean
      summary: Awaited<ReturnType<typeof executeLegacyEmployeeSync>>["summary"]
      conflicts: Awaited<ReturnType<typeof executeLegacyEmployeeSync>>["conflicts"]
      invalidRows: Awaited<ReturnType<typeof executeLegacyEmployeeSync>>["invalidRows"]
      errors: Awaited<ReturnType<typeof executeLegacyEmployeeSync>>["errors"]
    }
  | {
      ok: false
      error: string
    }

export async function syncLegacyEmployeesAction(
  input: SyncLegacyEmployeesInput
): Promise<SyncLegacyEmployeesActionResult> {
  const parsed = syncLegacyEmployeesInputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue
        ? `Invalid sync payload at ${issue.path.join(".")}: ${issue.message}`
        : "Invalid sync payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have permission to run employee sync." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    const report = await executeLegacyEmployeeSync({
      companyId: payload.companyId,
      baseUrl: payload.baseUrl,
      legacyScopeId: payload.legacyScopeId,
      apiToken: payload.apiToken,
      employeeEndpoint: payload.employeeEndpoint,
      timeoutMs: payload.timeoutMs,
      dryRun: payload.dryRun,
    })

    if (!payload.dryRun) {
      revalidatePath(`/${context.companyId}/settings/employment`)
      revalidatePath(`/${context.companyId}/settings/employment/legacy-sync`)
      revalidatePath(`/${context.companyId}/employees`)
      revalidatePath(`/${context.companyId}/employees/user-access`)
    }

    return {
      ok: true,
      message: payload.dryRun
        ? "Dry run completed. No employee records were written."
        : "Legacy employee sync completed.",
      dryRun: payload.dryRun,
      summary: report.summary,
      conflicts: report.conflicts,
      invalidRows: report.invalidRows,
      errors: report.errors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Legacy employee sync failed: ${message}` }
  }
}

