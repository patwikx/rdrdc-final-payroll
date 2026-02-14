"use server"

import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { parsePhDateInputToUtcDateOnly } from "@/lib/ph-time"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  companyProfileInputSchema,
  type CompanyProfileInput,
} from "@/modules/settings/company/schemas/company-profile-schema"

type UpdateCompanyProfileActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const toNullable = (value: string | undefined): string | null => {
  if (!value) {
    return null
  }

  return value
}

const parsePhDate = (value: string | undefined): Date | null => {
  if (!value) {
    return null
  }

  return parsePhDateInputToUtcDateOnly(value)
}

export async function updateCompanyProfileAction(
  input: CompanyProfileInput
): Promise<UpdateCompanyProfileActionResult> {
  const parsed = companyProfileInputSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: firstIssue
        ? `Invalid company profile at ${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid company profile payload.",
    }
  }

  const context = await getActiveCompanyContext({ companyId: parsed.data.companyId })

  if (!hasModuleAccess(context.companyRole as CompanyRole, "settings")) {
    return { ok: false, error: "You do not have access to update company settings." }
  }

  const payload = parsed.data

  const existing = await db.company.findUnique({
    where: { id: context.companyId },
    select: {
      id: true,
      code: true,
      name: true,
      legalName: true,
      tradeName: true,
      abbreviation: true,
      secDtiNumber: true,
      dateOfIncorporation: true,
      tinNumber: true,
      rdoCode: true,
      sssEmployerNumber: true,
      sssBranchCode: true,
      philHealthEmployerNumber: true,
      pagIbigEmployerNumber: true,
      industryCode: true,
      companySizeCode: true,
      statusCode: true,
      parentCompanyId: true,
      logoUrl: true,
      websiteUrl: true,
      payslipWatermarkText: true,
      fiscalYearStartMonth: true,
      defaultCurrency: true,
      minimumWageRegion: true,
      isActive: true,
    },
  })

  if (!existing) {
    return { ok: false, error: "Company profile not found." }
  }

  try {
    await db.$transaction(async (tx) => {
      const updatedCompany = await tx.company.update({
        where: { id: context.companyId },
        data: {
          code: payload.company.code,
          name: payload.company.name,
          legalName: toNullable(payload.company.legalName),
          tradeName: toNullable(payload.company.tradeName),
          abbreviation: toNullable(payload.company.abbreviation),
          secDtiNumber: toNullable(payload.company.secDtiNumber),
          dateOfIncorporation: parsePhDate(payload.company.dateOfIncorporation),
          tinNumber: toNullable(payload.company.tinNumber),
          rdoCode: toNullable(payload.company.rdoCode),
          sssEmployerNumber: toNullable(payload.company.sssEmployerNumber),
          sssBranchCode: toNullable(payload.company.sssBranchCode),
          philHealthEmployerNumber: toNullable(payload.company.philHealthEmployerNumber),
          pagIbigEmployerNumber: toNullable(payload.company.pagIbigEmployerNumber),
          industryCode: payload.company.industryCode ?? null,
          companySizeCode: payload.company.companySizeCode ?? null,
          statusCode: payload.company.statusCode ?? null,
          parentCompanyId: toNullable(payload.company.parentCompanyId),
          logoUrl: toNullable(payload.company.logoUrl),
          websiteUrl: toNullable(payload.company.websiteUrl),
          payslipWatermarkText: toNullable(payload.company.payslipWatermarkText),
          fiscalYearStartMonth: payload.company.fiscalYearStartMonth,
          defaultCurrency: payload.company.defaultCurrency,
          minimumWageRegion: toNullable(payload.company.minimumWageRegion),
          isActive: payload.company.isActive,
          updatedById: context.userId,
        },
      })

      const primaryAddress = await tx.companyAddress.findFirst({
        where: { companyId: context.companyId, isPrimary: true },
        select: { id: true },
      })

      if (primaryAddress) {
        await tx.companyAddress.update({
          where: { id: primaryAddress.id },
          data: {
            addressTypeId: payload.primaryAddress.addressTypeId,
            street: toNullable(payload.primaryAddress.street),
            barangay: toNullable(payload.primaryAddress.barangay),
            city: toNullable(payload.primaryAddress.city),
            municipality: toNullable(payload.primaryAddress.municipality),
            province: toNullable(payload.primaryAddress.province),
            region: toNullable(payload.primaryAddress.region),
            postalCode: toNullable(payload.primaryAddress.postalCode),
            country: payload.primaryAddress.country,
            isActive: true,
          },
        })
      } else {
        await tx.companyAddress.create({
          data: {
            companyId: context.companyId,
            addressTypeId: payload.primaryAddress.addressTypeId,
            street: toNullable(payload.primaryAddress.street),
            barangay: toNullable(payload.primaryAddress.barangay),
            city: toNullable(payload.primaryAddress.city),
            municipality: toNullable(payload.primaryAddress.municipality),
            province: toNullable(payload.primaryAddress.province),
            region: toNullable(payload.primaryAddress.region),
            postalCode: toNullable(payload.primaryAddress.postalCode),
            country: payload.primaryAddress.country,
            isPrimary: true,
            isActive: true,
          },
        })
      }

      const primaryContact = await tx.companyContact.findFirst({
        where: { companyId: context.companyId, isPrimary: true },
        select: { id: true },
      })

      if (primaryContact) {
        await tx.companyContact.update({
          where: { id: primaryContact.id },
          data: {
            contactTypeId: payload.primaryContact.contactTypeId,
            countryCode: toNullable(payload.primaryContact.countryCode),
            areaCode: toNullable(payload.primaryContact.areaCode),
            number: payload.primaryContact.number,
            extension: toNullable(payload.primaryContact.extension),
            isActive: true,
          },
        })
      } else {
        await tx.companyContact.create({
          data: {
            companyId: context.companyId,
            contactTypeId: payload.primaryContact.contactTypeId,
            countryCode: toNullable(payload.primaryContact.countryCode) ?? "+63",
            areaCode: toNullable(payload.primaryContact.areaCode),
            number: payload.primaryContact.number,
            extension: toNullable(payload.primaryContact.extension),
            isPrimary: true,
            isActive: true,
          },
        })
      }

      const primaryEmail = await tx.companyEmail.findFirst({
        where: { companyId: context.companyId, isPrimary: true },
        select: { id: true },
      })

      if (primaryEmail) {
        await tx.companyEmail.update({
          where: { id: primaryEmail.id },
          data: {
            emailTypeId: payload.primaryEmail.emailTypeId,
            email: payload.primaryEmail.email,
            isActive: true,
          },
        })
      } else {
        await tx.companyEmail.create({
          data: {
            companyId: context.companyId,
            emailTypeId: payload.primaryEmail.emailTypeId,
            email: payload.primaryEmail.email,
            isPrimary: true,
            isActive: true,
          },
        })
      }

      await createAuditLog(
        {
          tableName: "Company",
          recordId: context.companyId,
          action: "UPDATE",
          userId: context.userId,
          reason: "COMPANY_PROFILE_UPDATED",
          changes: [
            { fieldName: "name", oldValue: existing.name, newValue: updatedCompany.name },
            { fieldName: "code", oldValue: existing.code, newValue: updatedCompany.code },
            {
              fieldName: "payslipWatermarkText",
              oldValue: existing.payslipWatermarkText,
              newValue: updatedCompany.payslipWatermarkText,
            },
            { fieldName: "isActive", oldValue: existing.isActive, newValue: updatedCompany.isActive },
          ],
        },
        tx
      )
    })

    revalidatePath(`/${context.companyId}/settings/company`)
    revalidatePath(`/${context.companyId}/dashboard`)

    return { ok: true, message: "Company profile updated successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Failed to update company profile: ${message}` }
  }
}
