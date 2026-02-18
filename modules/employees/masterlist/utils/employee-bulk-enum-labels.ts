import { BloodType, CivilStatus, Gender, Religion, TaxStatus } from "@prisma/client"

export const EMPLOYEE_BULK_GENDER_LABELS: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
}

export const EMPLOYEE_BULK_CIVIL_STATUS_LABELS: Record<CivilStatus, string> = {
  SINGLE: "Single",
  MARRIED: "Married",
  WIDOWED: "Widowed",
  SEPARATED: "Separated",
  ANNULLED: "Annulled",
}

export const EMPLOYEE_BULK_RELIGION_LABELS: Record<Religion, string> = {
  ROMAN_CATHOLIC: "Roman Catholic",
  ISLAM: "Islam",
  INC: "INC",
  CHRISTIAN: "Christian",
  BUDDHISM: "Buddhism",
  OTHER: "Other",
}

export const EMPLOYEE_BULK_BLOOD_TYPE_LABELS: Record<BloodType, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  O_POS: "O+",
  O_NEG: "O-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
}

export const EMPLOYEE_BULK_TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  S: "Single",
  S1: "Single (1 Dependent)",
  S2: "Single (2 Dependents)",
  S3: "Single (3 Dependents)",
  S4: "Single (4 Dependents)",
  ME: "Married",
  ME1: "Married (1 Dependent)",
  ME2: "Married (2 Dependents)",
  ME3: "Married (3 Dependents)",
  ME4: "Married (4 Dependents)",
  Z: "Zero Exemption",
}
