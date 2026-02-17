export type ReportPagination = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export type ReportSortDirection = "asc" | "desc"

export type SalaryHistoryReportRow = {
  salaryHistoryId: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  effectiveDateValue: string
  previousSalaryAmount: number | null
  newSalaryAmount: number
  deltaAmount: number | null
  adjustmentTypeCode: string | null
  reason: string | null
  remarks: string | null
  createdAtIso: string
}

export type SalaryHistoryReportViewModel = {
  companyId: string
  companyName: string
  rows: SalaryHistoryReportRow[]
  pagination?: ReportPagination
}

export type MonthlyBirWTaxReportRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  tinNumberMasked: string | null
  runNumbers: string[]
  withholdingTaxAmount: number
}

export type MonthlyBirWTaxReportViewModel = {
  companyId: string
  companyName: string
  year: number
  month: number
  includeTrialRuns: boolean
  rows: MonthlyBirWTaxReportRow[]
  totalWithholdingTaxAmount: number
}

export type LateOvertimeTopEmployeeRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  lateMins: number
  lateDays: number
  lateBreakdownLabel: string
  lateDailyBreakdown: Array<{
    dateValue: string
    dateLabel: string
    lateMins: number
  }>
  overtimeHours: number
  overtimeDays: number
  overtimeBreakdownLabel: string
  overtimeDailyBreakdown: Array<{
    dateValue: string
    dateLabel: string
    overtimeHours: number
  }>
  overtimePayAmount: number
  tardinessDeductionAmount: number
}

export type LateOvertimeTopDepartmentRow = {
  departmentId: string | null
  departmentName: string
  employeeCount: number
  lateMins: number
  lateDays: number
  overtimeHours: number
  overtimeDays: number
  overtimePayAmount: number
  tardinessDeductionAmount: number
}

export type LateOvertimeSummary = {
  startDateValue: string
  endDateValue: string
  periodLabel: string
  totalLateMins: number
  totalOvertimeHours: number
  totalOvertimePayAmount: number
  totalTardinessDeductionAmount: number
}

export type LateOvertimeReportViewModel = {
  companyId: string
  companyName: string
  summary: LateOvertimeSummary
  topEmployeesByLate: LateOvertimeTopEmployeeRow[]
  topEmployeesByOvertime: LateOvertimeTopEmployeeRow[]
  topDepartmentsByLate: LateOvertimeTopDepartmentRow[]
  topDepartmentsByOvertime: LateOvertimeTopDepartmentRow[]
}

export const LATE_OVERTIME_REPORT_SECTIONS = [
  "employees-late",
  "employees-overtime",
  "departments-late",
  "departments-overtime",
] as const

export type LateOvertimeReportSectionKey = (typeof LATE_OVERTIME_REPORT_SECTIONS)[number]

export type LateOvertimeSectionFilters = {
  startDate: string
  endDate: string
  topN: number
}

export type LateOvertimeSectionDataResponse =
  | {
      section: "employees-late" | "employees-overtime"
      filters: LateOvertimeSectionFilters
      summary: LateOvertimeSummary
      employeeRows: LateOvertimeTopEmployeeRow[]
    }
  | {
      section: "departments-late" | "departments-overtime"
      filters: LateOvertimeSectionFilters
      summary: LateOvertimeSummary
      departmentRows: LateOvertimeTopDepartmentRow[]
    }

export type PayrollRegisterDynamicColumn = {
  code: string
  label: string
  category: "EARNING" | "DEDUCTION"
  sortOrder: number
}

export type PayrollRegisterRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentId: string | null
  departmentName: string
  periodStartValue: string
  periodEndValue: string
  basicPayAmount: number
  sssAmount: number
  philHealthAmount: number
  pagIbigAmount: number
  taxAmount: number
  sssLoanAmount: number
  absentAmount: number
  lateAmount: number
  undertimeAmount: number
  netPayAmount: number
  dynamicAmountsByCode: Record<string, number>
}

export type PayrollRegisterReportViewModel = {
  companyId: string
  companyName: string
  runId: string
  runNumber: string
  runTypeCode: string
  headcount: number
  columns: PayrollRegisterDynamicColumn[]
  rows: PayrollRegisterRow[]
}

export type DemographicBreakdownRow = {
  key: string
  label: string
  count: number
  percentage: number
}

export type DemographicEmployeeRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string | null
  branchName: string | null
  genderLabel: string
  civilStatusLabel: string
  employmentStatusName: string
  employmentTypeName: string
  employmentClassName: string
  hireDateValue: string
  ageYears: number | null
  ageBracketLabel: string
  addressLabel: string
  contactNumbersLabel: string
  emergencyContactName: string
  emergencyContactNumber: string
  educationLabel: string
  isActive: boolean
}

export type DemographicReportViewModel = {
  companyId: string
  companyName: string
  asOfDateValue: string
  totalEmployees: number
  activeEmployees: number
  inactiveEmployees: number
  averageAgeYears: number | null
  filters: {
    departmentId: string
    includeInactive: boolean
  }
  options: {
    departments: Array<{ id: string; label: string }>
  }
  breakdowns: {
    byGender: DemographicBreakdownRow[]
    byCivilStatus: DemographicBreakdownRow[]
    byEmploymentStatus: DemographicBreakdownRow[]
    byEmploymentType: DemographicBreakdownRow[]
    byEmploymentClass: DemographicBreakdownRow[]
    byDepartment: DemographicBreakdownRow[]
    byBranch: DemographicBreakdownRow[]
    byAgeBracket: DemographicBreakdownRow[]
  }
  employees: DemographicEmployeeRow[]
}

export type CertificateOfEmploymentEmployeeOption = {
  id: string
  label: string
}

export type CertificateOfEmploymentSignatoryOption = {
  id: string
  label: string
  defaultDepartmentId: string | null
}

export type CertificateOfEmploymentDepartmentOption = {
  id: string
  label: string
}

export type CertificateOfEmploymentEmployeeDetails = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  positionName: string
  departmentName: string
  hireDateValue: string
  separationDateValue: string | null
  employmentDurationLabel: string
  monthlySalaryAmount: number | null
  annualSalaryAmount: number | null
  midYearBonusAmount: number | null
  thirteenthMonthBonusAmount: number | null
  compensationCurrency: string
  compensationRateTypeLabel: string
}

export type CertificateOfEmploymentViewModel = {
  companyId: string
  companyName: string
  companyLegalName: string | null
  companyLogoUrl: string | null
  companyAddressLines: string[]
  companyContactLines: string[]
  issueLocationLabel: string
  certificateDateValue: string
  includeCompensation: boolean
  purpose: string
  selectedEmployeeId: string
  selectedSignatoryId: string
  selectedSignatoryDepartmentId: string
  signatoryName: string
  signatorySignatureUrl: string | null
  signatoryDepartmentName: string
  generatedAtLabel: string
  options: {
    employees: CertificateOfEmploymentEmployeeOption[]
    signatories: CertificateOfEmploymentSignatoryOption[]
    signatoryDepartments: CertificateOfEmploymentDepartmentOption[]
  }
  employee: CertificateOfEmploymentEmployeeDetails | null
}
