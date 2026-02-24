"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  deleteLegacyMaterialRequestsInputSchema,
  type DeleteLegacyMaterialRequestsInput,
} from "@/modules/settings/material-requests/schemas/delete-legacy-material-requests-schema"
import {
  buildLegacyMaterialRequestWhere,
  getLegacyMaterialRequestCleanupSummary,
} from "@/modules/settings/material-requests/utils/get-legacy-material-request-cleanup-summary"

type DeleteLegacyMaterialRequestsActionResult =
  | {
      ok: true
      message: string
      deletedCount: number
    }
  | {
      ok: false
      error: string
    }

const createRevalidationPaths = (companyId: string): string[] => {
  return [
    `/${companyId}/settings/material-requests`,
    `/${companyId}/settings/material-requests/legacy-sync`,
    `/${companyId}/settings/material-requests/legacy-cleanup`,
    `/${companyId}/employee-portal/material-requests`,
    `/${companyId}/employee-portal/material-request-approvals`,
    `/${companyId}/employee-portal/material-request-processing`,
    `/${companyId}/employee-portal/material-request-posting`,
    `/${companyId}/employee-portal/material-request-receiving-reports`,
    `/${companyId}/employee-portal/approvers`,
    `/${companyId}/dashboard`,
  ]
}

export async function deleteLegacyMaterialRequestsAction(
  input: DeleteLegacyMaterialRequestsInput
): Promise<DeleteLegacyMaterialRequestsActionResult> {
  const parsed = deleteLegacyMaterialRequestsInputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue
        ? `Invalid delete payload at ${issue.path.join(".")}: ${issue.message}`
        : "Invalid delete payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have permission to delete legacy material requests." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  try {
    const deletion = await db.$transaction(async (tx) => {
      const summary = await getLegacyMaterialRequestCleanupSummary({
        companyId: context.companyId,
        client: tx,
      })

      if (summary.totalLegacyRequests === 0) {
        return { deletedCount: 0, summary }
      }

      const legacyRequestIds = (
        await tx.materialRequest.findMany({
          where: buildLegacyMaterialRequestWhere(context.companyId),
          select: {
            id: true,
          },
        })
      ).map((row) => row.id)

      if (legacyRequestIds.length === 0) {
        return { deletedCount: 0, summary }
      }

      await tx.materialRequestServeBatchItem.deleteMany({
        where: {
          batch: {
            materialRequestId: {
              in: legacyRequestIds,
            },
          },
        },
      })

      await tx.materialRequestReceivingReportItem.deleteMany({
        where: {
          receivingReport: {
            materialRequestId: {
              in: legacyRequestIds,
            },
          },
        },
      })

      const deleted = await tx.materialRequest.deleteMany({
        where: {
          id: {
            in: legacyRequestIds,
          },
        },
      })

      await createAuditLog(
        {
          tableName: "MaterialRequest",
          recordId: `${context.companyId}:legacy-material-requests`,
          action: "DELETE",
          userId: context.userId,
          reason: "LEGACY_MATERIAL_REQUESTS_BULK_DELETED",
          changes: [
            { fieldName: "deletedCount", oldValue: summary.totalLegacyRequests, newValue: 0 },
            {
              fieldName: "deletedStatusCounts",
              oldValue: summary.statusCounts,
            },
            {
              fieldName: "deletedLegacyRecordIdCount",
              oldValue: summary.requestsWithLegacyRecordId,
            },
            {
              fieldName: "deletedLegacySourceSystemCount",
              oldValue: summary.requestsWithLegacySourceSystem,
            },
            {
              fieldName: "firstCreatedAt",
              oldValue: summary.firstCreatedAt,
            },
            {
              fieldName: "lastCreatedAt",
              oldValue: summary.lastCreatedAt,
            },
            {
              fieldName: "deletedByUserId",
              newValue: context.userId,
            },
          ],
        },
        tx
      )

      return {
        deletedCount: deleted.count,
        summary,
      }
    })

    for (const path of createRevalidationPaths(context.companyId)) {
      revalidatePath(path)
    }

    if (deletion.deletedCount === 0) {
      return {
        ok: true,
        deletedCount: 0,
        message: "No legacy-tagged material requests found for this company.",
      }
    }

    return {
      ok: true,
      deletedCount: deletion.deletedCount,
      message: `Deleted ${deletion.deletedCount} legacy-tagged material request(s).`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to delete legacy material requests: ${message}` }
  }
}
