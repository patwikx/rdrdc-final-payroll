import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyProfileInput } from "@/modules/settings/company/schemas/company-profile-schema"

type ParentCompanyOption = {
  id: string
  code: string
  name: string
}

export type CompanyProfileViewModel = {
  companyName: string
  companyCode: string
  companyRole: string
  parentCompanyOptions: ParentCompanyOption[]
  form: CompanyProfileInput
}

const toDateInputValue = (value: Date | null | undefined): string => {
  if (!value) {
    return ""
  }

  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, "0")
  const day = String(value.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

const toText = (value: string | null | undefined): string => value ?? ""

export async function getCompanyProfileViewModel(companyId: string): Promise<CompanyProfileViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const [company, parentCompanyOptions] = await Promise.all([
    db.company.findUnique({
      where: { id: context.companyId },
      include: {
        addresses: {
          where: { isPrimary: true, isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        contacts: {
          where: { isPrimary: true, isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        emails: {
          where: { isPrimary: true, isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }),
    db.company.findMany({
      where: {
        id: { not: context.companyId },
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: [{ name: "asc" }],
    }),
  ])

  if (!company) {
    throw new Error("Company profile not found.")
  }

  const primaryAddress = company.addresses[0]
  const primaryContact = company.contacts[0]
  const primaryEmail = company.emails[0]

  return {
    companyName: context.companyName,
    companyCode: context.companyCode,
    companyRole: context.companyRole,
    parentCompanyOptions,
    form: {
      companyId: company.id,
      company: {
        code: company.code,
        name: company.name,
        legalName: toText(company.legalName),
        tradeName: toText(company.tradeName),
        abbreviation: toText(company.abbreviation),
        secDtiNumber: toText(company.secDtiNumber),
        dateOfIncorporation: toDateInputValue(company.dateOfIncorporation),
        tinNumber: toText(company.tinNumber),
        rdoCode: toText(company.rdoCode),
        sssEmployerNumber: toText(company.sssEmployerNumber),
        sssBranchCode: toText(company.sssBranchCode),
        philHealthEmployerNumber: toText(company.philHealthEmployerNumber),
        pagIbigEmployerNumber: toText(company.pagIbigEmployerNumber),
        industryCode: company.industryCode ?? undefined,
        companySizeCode: company.companySizeCode ?? undefined,
        statusCode: company.statusCode ?? undefined,
        parentCompanyId: company.parentCompanyId ?? "",
        logoUrl: toText(company.logoUrl),
        websiteUrl: toText(company.websiteUrl),
        payslipWatermarkText: toText(company.payslipWatermarkText),
        fiscalYearStartMonth: company.fiscalYearStartMonth,
        defaultCurrency: company.defaultCurrency,
        minimumWageRegion: toText(company.minimumWageRegion),
        isActive: company.isActive,
      },
      primaryAddress: {
        addressTypeId: primaryAddress?.addressTypeId ?? "MAIN",
        street: toText(primaryAddress?.street),
        barangay: toText(primaryAddress?.barangay),
        city: toText(primaryAddress?.city),
        municipality: toText(primaryAddress?.municipality),
        province: toText(primaryAddress?.province),
        region: toText(primaryAddress?.region),
        postalCode: toText(primaryAddress?.postalCode),
        country: primaryAddress?.country ?? "Philippines",
      },
      primaryContact: {
        contactTypeId: primaryContact?.contactTypeId ?? "MOBILE",
        countryCode: toText(primaryContact?.countryCode ?? "+63"),
        areaCode: toText(primaryContact?.areaCode),
        number: toText(primaryContact?.number),
        extension: toText(primaryContact?.extension),
      },
      primaryEmail: {
        emailTypeId: primaryEmail?.emailTypeId ?? "WORK",
        email: toText(primaryEmail?.email),
      },
    },
  }
}
