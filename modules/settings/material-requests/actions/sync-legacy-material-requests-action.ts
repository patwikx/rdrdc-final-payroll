"use server"

import { revalidatePath } from "next/cache"

import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  syncLegacyMaterialRequestsInputSchema,
  type SyncLegacyMaterialRequestsInput,
} from "@/modules/settings/material-requests/schemas/sync-legacy-material-requests-schema"
import { executeLegacyMaterialRequestSync } from "@/modules/settings/material-requests/utils/execute-legacy-material-request-sync"

type SyncLegacyMaterialRequestsActionResult =
  | {
      ok: true
      message: string
      dryRun: boolean
      summary: Awaited<ReturnType<typeof executeLegacyMaterialRequestSync>>["summary"]
      unmatched: Awaited<ReturnType<typeof executeLegacyMaterialRequestSync>>["unmatched"]
      skipped: Awaited<ReturnType<typeof executeLegacyMaterialRequestSync>>["skipped"]
      errors: Awaited<ReturnType<typeof executeLegacyMaterialRequestSync>>["errors"]
    }
  | {
      ok: false
      error: string
    }

const MAX_ROWS_PER_SECTION = 200

export async function syncLegacyMaterialRequestsAction(
  input: SyncLegacyMaterialRequestsInput
): Promise<SyncLegacyMaterialRequestsActionResult> {
  const parsed = syncLegacyMaterialRequestsInputSchema.safeParse(input)
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
    const report = await executeLegacyMaterialRequestSync({
      companyId: payload.companyId,
      actorUserId: context.userId,
      baseUrl: payload.baseUrl,
      legacyScopeId: payload.legacyScopeId,
      apiToken: payload.apiToken,
      materialRequestEndpoint: payload.materialRequestEndpoint,
      timeoutMs: payload.timeoutMs,
      dryRun: payload.dryRun,
      targetLegacyRecordIds: payload.targetLegacyRecordIds,
      manualOverrides: payload.manualOverrides,
    })

    if (!payload.dryRun) {
      revalidatePath(`/${context.companyId}/settings/material-requests`)
      revalidatePath(`/${context.companyId}/settings/material-requests/legacy-sync`)
      revalidatePath(`/${context.companyId}/employee-portal/material-requests`)
      revalidatePath(`/${context.companyId}/employee-portal/material-request-approvals`)
      revalidatePath(`/${context.companyId}/employee-portal/material-request-processing`)
      revalidatePath(`/${context.companyId}/employee-portal/material-request-posting`)
      revalidatePath(`/${context.companyId}/employee-portal/approvers`)
      revalidatePath(`/${context.companyId}/dashboard`)
    }

    return {
      ok: true,
      message: payload.dryRun
        ? "Dry run completed. No material requests were written."
        : "Legacy material request sync completed.",
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
