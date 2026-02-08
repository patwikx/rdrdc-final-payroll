import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))

const optionalEmail = z
  .string()
  .trim()
  .email()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))

export const taxStatusOptions = ["S", "S1", "S2", "S3", "S4", "ME", "ME1", "ME2", "ME3", "ME4", "Z"] as const
export const genderOptions = ["MALE", "FEMALE"] as const
export const civilStatusOptions = ["SINGLE", "MARRIED", "WIDOWED", "SEPARATED", "ANNULLED"] as const
export const relationshipOptions = ["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"] as const
export const documentTypeOptions = [
  "BIRTH_CERT",
  "NBI_CLEARANCE",
  "CONTRACT",
  "TIN_ID",
  "SSS_ID",
  "PHILHEALTH_ID",
  "PAGIBIG_ID",
  "OTHER",
] as const

const uploadedDocumentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  documentTypeId: z.enum(documentTypeOptions),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().trim().min(1).max(60),
  fileSize: z.coerce.number().int().min(1),
  fileDataUrl: z.string().trim().min(20),
})

export const employeeOnboardingInputSchema = z.object({
  companyId: z.string().uuid(),

  identity: z.object({
    employeeNumber: z.string().trim().min(1).max(50),
    firstName: z.string().trim().min(1).max(100),
    middleName: optionalText,
    lastName: z.string().trim().min(1).max(100),
    suffix: optionalText,
    nickname: optionalText,
    birthDate: z.string().date(),
    birthPlace: optionalText,
    genderId: z.enum(genderOptions),
    civilStatusId: z.enum(civilStatusOptions).optional(),
    nationality: optionalText,
    citizenship: optionalText,
  }),

  contact: z.object({
    mobileNumber: z.string().trim().min(7).max(25),
    personalEmail: z.string().trim().email(),
    workEmail: optionalEmail,
    street: optionalText,
    barangay: optionalText,
    city: optionalText,
    province: optionalText,
    postalCode: optionalText,
    emergencyContactName: optionalText,
    emergencyContactNumber: optionalText,
    emergencyRelationshipId: z.enum(relationshipOptions).optional(),
  }),

  employment: z.object({
    hireDate: z.string().date(),
    employmentStatusId: z.string().uuid(),
    employmentTypeId: z.string().uuid(),
    employmentClassId: z.string().uuid(),
    departmentId: z.string().uuid(),
    divisionId: z.string().uuid().optional(),
    positionId: z.string().uuid(),
    rankId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    reportingManagerId: z.string().uuid().optional(),
    probationEndDate: z.string().date().optional(),
    regularizationDate: z.string().date().optional(),
  }),

  payroll: z.object({
    monthlyRate: z.coerce.number().positive(),
    workScheduleId: z.string().uuid(),
    payPeriodPatternId: z.string().uuid(),
    monthlyDivisor: z.coerce.number().int().min(1).max(366),
    hoursPerDay: z.coerce.number().min(1).max(24),
    minimumWageRegion: optionalText,
    isNightDiffEligible: z.boolean(),
    isOvertimeEligible: z.boolean(),
    isWfhEligible: z.boolean(),
    wfhSchedule: optionalText,
  }),

  tax: z.object({
    taxStatusId: z.enum(taxStatusOptions),
    numberOfDependents: z.coerce.number().int().min(0).max(20),
    isSubstitutedFiling: z.boolean(),
    tin: optionalText,
    sssNumber: optionalText,
    philHealthNumber: optionalText,
    pagIbigNumber: optionalText,
    previousEmployerIncome: z.coerce.number().min(0).optional(),
    previousEmployerTaxWithheld: z.coerce.number().min(0).optional(),
    notes: optionalText,
  }),

  uploads: z.object({
    profilePhotoDataUrl: z
      .string()
      .trim()
      .min(20)
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    profilePhotoFileName: optionalText,
    scannedDocuments: z.array(uploadedDocumentSchema).max(10),
  }),
})

export type EmployeeOnboardingInput = z.infer<typeof employeeOnboardingInputSchema>
