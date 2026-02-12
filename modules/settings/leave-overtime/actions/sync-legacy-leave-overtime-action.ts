"use server"

import { revalidatePath } from "next/cache"

import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  syncLegacyLeaveOvertimeInputSchema,
  type SyncLegacyLeaveOvertimeInput,
} from "@/modules/settings/leave-overtime/schemas/sync-legacy-leave-overtime-schema"
import { executeLegacyLeaveOvertimeSync } from "@/modules/settings/leave-overtime/utils/execute-legacy-leave-overtime-sync"

type SyncLegacyLeaveOvertimeActionResult =
  | {
      ok: true
      message: string
      dryRun: boolean
      summary: Awaited<ReturnType<typeof executeLegacyLeaveOvertimeSync>>["summary"]
      unmatched: Awaited<ReturnType<typeof executeLegacyLeaveOvertimeSync>>["unmatched"]
      skipped: Awaited<ReturnType<typeof executeLegacyLeaveOvertimeSync>>["skipped"]
      errors: Awaited<ReturnType<typeof executeLegacyLeaveOvertimeSync>>["errors"]
    }
  | {
      ok: false
      error: string
    }

const MAX_ROWS_PER_SECTION = 200

export async function syncLegacyLeaveOvertimeAction(
  input: SyncLegacyLeaveOvertimeInput
): Promise<SyncLegacyLeaveOvertimeActionResult> {
  const parsed = syncLegacyLeaveOvertimeInputSchema.safeParse(input)
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
    return { ok: false, error: "You do not have permission to run legacy sync." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    const report = await executeLegacyLeaveOvertimeSync({
      companyId: payload.companyId,
      baseUrl: payload.baseUrl,
      legacyScopeId: payload.legacyScopeId,
      apiToken: payload.apiToken,
      leaveEndpoint: payload.leaveEndpoint,
      overtimeEndpoint: payload.overtimeEndpoint,
      balanceEndpoint: payload.balanceEndpoint,
      timeoutMs: payload.timeoutMs,
      dryRun: payload.dryRun,
    })

    if (!payload.dryRun) {
      revalidatePath(`/${context.companyId}/settings/leave-overtime`)
      revalidatePath(`/${context.companyId}/settings/leave-overtime/legacy-sync`)
      revalidatePath(`/${context.companyId}/leave/balances`)
      revalidatePath(`/${context.companyId}/employee-portal/leaves`)
      revalidatePath(`/${context.companyId}/employee-portal/overtime`)
      revalidatePath(`/${context.companyId}/approvals`)
    }

    return {
      ok: true,
      message: payload.dryRun
        ? "Dry run completed. No records were written."
        : "Legacy leave/overtime sync completed.",
      dryRun: payload.dryRun,
      summary: report.summary,
      unmatched: report.unmatched.slice(0, MAX_ROWS_PER_SECTION),
      skipped: report.skipped.slice(0, MAX_ROWS_PER_SECTION),
      errors: report.errors.slice(0, MAX_ROWS_PER_SECTION),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Legacy sync failed: ${message}` }
  }
}
