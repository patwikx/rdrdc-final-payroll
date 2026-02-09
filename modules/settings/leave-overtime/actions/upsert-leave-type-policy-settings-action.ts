"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  upsertLeaveTypePolicySettingsInputSchema,
  type UpsertLeaveTypePolicySettingsInput,
} from "@/modules/settings/leave-overtime/schemas/leave-ot-policy-settings-schema"

type UpsertLeaveTypePolicySettingsActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const parseDateInput = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part))
  return new Date(Date.UTC(year, month - 1, day))
}

const toDecimalText = (value: number): string => {
  return value.toFixed(2)
}

export async function upsertLeaveTypePolicySettingsAction(
  input: UpsertLeaveTypePolicySettingsInput
): Promise<UpsertLeaveTypePolicySettingsActionResult> {
  const parsed = upsertLeaveTypePolicySettingsInputSchema.safeParse(input)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue ? `Invalid leave policy payload at ${issue.path.join(".")}: ${issue.message}` : "Invalid leave policy payload.",
    }
  }

  const payload = parsed.data
  const context = await getActiveCompanyContext({ companyId: payload.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to leave settings." }
  }

  if (context.companyId !== payload.companyId) {
    return { ok: false, error: "Company context mismatch." }
  }

  const effectiveFrom = parseDateInput(payload.effectiveFrom)

  try {
    await db.$transaction(async (tx) => {
      let leaveTypeId = payload.leaveTypeId

      const validEmploymentStatus = await tx.employmentStatus.findFirst({
        where: {
          id: payload.employmentStatusId,
          companyId: context.companyId,
        },
        select: { id: true },
      })

      if (!validEmploymentStatus) {
        throw new Error("Employment status not found in the active company.")
      }

      if (leaveTypeId) {
        const existing = await tx.leaveType.findFirst({
          where: { id: leaveTypeId, companyId: context.companyId },
          select: { id: true },
        })

        if (!existing) {
          throw new Error("Leave type not found in the active company.")
        }

        await tx.leaveType.update({
          where: { id: leaveTypeId },
          data: {
            code: payload.code,
            name: payload.name,
            description: payload.description?.trim() || null,
            isPaid: payload.isPaid,
            isCarriedOver: payload.isCarriedOver,
            maxCarryOverDays: payload.isCarriedOver ? toDecimalText(payload.maxCarryOverDays ?? 0) : null,
            allowHalfDay: payload.allowHalfDay,
            requiresApproval: payload.requiresApproval,
            statusApplicability: payload.statusApplicability,
            isActive: payload.isActive,
          },
        })
      } else {
        const created = await tx.leaveType.create({
          data: {
            companyId: context.companyId,
            code: payload.code,
            name: payload.name,
            description: payload.description?.trim() || null,
            isPaid: payload.isPaid,
            isCarriedOver: payload.isCarriedOver,
            maxCarryOverDays: payload.isCarriedOver ? toDecimalText(payload.maxCarryOverDays ?? 0) : null,
            allowHalfDay: payload.allowHalfDay,
            requiresApproval: payload.requiresApproval,
            statusApplicability: payload.statusApplicability,
            isActive: payload.isActive,
          },
          select: { id: true },
        })

        leaveTypeId = created.id
      }

      if (!leaveTypeId) {
        throw new Error("Unable to resolve leave type record.")
      }

      if (payload.policyId) {
        const existingPolicy = await tx.leavePolicy.findFirst({
          where: {
            id: payload.policyId,
            leaveTypeId,
          },
          select: { id: true },
        })

        if (!existingPolicy) {
          throw new Error("Leave policy not found for the selected leave type.")
        }

        await tx.leavePolicy.update({
          where: { id: payload.policyId },
          data: {
            employmentStatusId: payload.employmentStatusId,
            annualEntitlement: toDecimalText(payload.annualEntitlement),
            accrualMethodCode: payload.accrualMethodCode,
            prorationMethodCode: payload.prorationMethodCode,
            effectiveFrom,
            isActive: payload.isActive,
          },
        })
      } else {
        await tx.leavePolicy.upsert({
          where: {
            leaveTypeId_employmentStatusId_effectiveFrom: {
              leaveTypeId,
              employmentStatusId: payload.employmentStatusId,
              effectiveFrom,
            },
          },
          update: {
            annualEntitlement: toDecimalText(payload.annualEntitlement),
            accrualMethodCode: payload.accrualMethodCode,
            prorationMethodCode: payload.prorationMethodCode,
            isActive: payload.isActive,
          },
          create: {
            leaveTypeId,
            employmentStatusId: payload.employmentStatusId,
            annualEntitlement: toDecimalText(payload.annualEntitlement),
            accrualMethodCode: payload.accrualMethodCode,
            prorationMethodCode: payload.prorationMethodCode,
            effectiveFrom,
            isActive: payload.isActive,
          },
        })
      }

      await createAuditLog(
        {
          tableName: "LeaveTypePolicy",
          recordId: leaveTypeId,
          action: payload.leaveTypeId ? "UPDATE" : "CREATE",
          userId: context.userId,
          reason: "UPSERT_LEAVE_TYPE_POLICY_SETTINGS",
          changes: [
            { fieldName: "code", newValue: payload.code },
            { fieldName: "name", newValue: payload.name },
            { fieldName: "employmentStatusId", newValue: payload.employmentStatusId },
            { fieldName: "annualEntitlement", newValue: payload.annualEntitlement },
            { fieldName: "statusApplicability", newValue: payload.statusApplicability },
            { fieldName: "accrualMethodCode", newValue: payload.accrualMethodCode },
            { fieldName: "prorationMethodCode", newValue: payload.prorationMethodCode },
            { fieldName: "isActive", newValue: payload.isActive },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/leave-overtime`)

    return { ok: true, message: "Leave policy saved successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to save leave policy: ${message}` }
  }
}
