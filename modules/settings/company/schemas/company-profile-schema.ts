import { z } from "zod"

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const optionalText = (maxLength: number) =>
  z.preprocess(trimToUndefined, z.string().max(maxLength).optional())

const optionalDateString = z.preprocess(trimToUndefined, z.string().date().optional())

export const COMPANY_INDUSTRY_OPTIONS = [
  "TECHNOLOGY",
  "MANUFACTURING",
  "FINANCIAL",
  "HEALTHCARE",
  "RETAIL",
  "EDUCATION",
  "GOVERNMENT",
  "HOSPITALITY",
  "LOGISTICS",
  "AGRICULTURE",
  "CONSTRUCTION",
  "ENERGY",
  "REAL_ESTATE",
  "PROFESSIONAL_SERVICES",
  "OTHER",
] as const

export const COMPANY_SIZE_OPTIONS = ["MICRO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"] as const

export const COMPANY_STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"] as const

export const ADDRESS_TYPE_OPTIONS = ["HOME", "PERMANENT", "PROVINCIAL", "MAIN", "BRANCH", "WAREHOUSE"] as const

export const CONTACT_TYPE_OPTIONS = ["MOBILE", "LANDLINE", "FAX"] as const

export const EMAIL_TYPE_OPTIONS = ["PERSONAL", "WORK", "OTHER"] as const

const companyProfileCompanySchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  legalName: optionalText(180),
  tradeName: optionalText(180),
  abbreviation: optionalText(20),
  secDtiNumber: optionalText(50),
  dateOfIncorporation: optionalDateString,
  tinNumber: optionalText(20),
  rdoCode: optionalText(10),
  sssEmployerNumber: optionalText(30),
  sssBranchCode: optionalText(20),
  philHealthEmployerNumber: optionalText(30),
  pagIbigEmployerNumber: optionalText(30),
  industryCode: z.enum(COMPANY_INDUSTRY_OPTIONS).optional(),
  companySizeCode: z.enum(COMPANY_SIZE_OPTIONS).optional(),
  statusCode: z.enum(COMPANY_STATUS_OPTIONS).optional(),
  parentCompanyId: z.preprocess(trimToUndefined, z.string().uuid().optional()),
  logoUrl: z.preprocess(trimToUndefined, z.string().url().max(500).optional()),
  websiteUrl: z.preprocess(trimToUndefined, z.string().url().max(500).optional()),
  payslipWatermarkText: optionalText(80),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  defaultCurrency: z.string().trim().min(3).max(3),
  minimumWageRegion: optionalText(80),
  isActive: z.boolean(),
})

const companyProfileAddressSchema = z.object({
  addressTypeId: z.enum(ADDRESS_TYPE_OPTIONS),
  street: optionalText(200),
  barangay: optionalText(120),
  city: optionalText(120),
  municipality: optionalText(120),
  province: optionalText(120),
  region: optionalText(120),
  postalCode: optionalText(12),
  country: z.string().trim().min(2).max(120),
})

const companyProfileContactSchema = z
  .object({
    contactTypeId: z.enum(CONTACT_TYPE_OPTIONS),
    countryCode: optionalText(6),
    areaCode: optionalText(8),
    number: z.string().trim().min(1).max(30),
    extension: optionalText(10),
  })

const companyProfileEmailSchema = z
  .object({
    emailTypeId: z.enum(EMAIL_TYPE_OPTIONS),
    email: z.string().trim().email().max(160),
  })

export const companyProfileInputSchema = z.object({
  companyId: z.string().uuid(),
  company: companyProfileCompanySchema,
  primaryAddress: companyProfileAddressSchema,
  primaryContact: companyProfileContactSchema,
  primaryEmail: companyProfileEmailSchema,
})

export type CompanyProfileInput = z.infer<typeof companyProfileInputSchema>
