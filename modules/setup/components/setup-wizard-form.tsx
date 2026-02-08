"use client"

import { motion } from "framer-motion"
import { IconTrash } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { type Dispatch, type SetStateAction, useMemo, useState } from "react"
import type { ZodIssue } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setupDraftSchema, type SetupDraftInput } from "@/modules/setup/schemas/initialize-system-schema"

const SETUP_DRAFT_STORAGE_KEY = "setupDraftV1"

const REQUIRED = <span className="ml-1 text-destructive">*</span>

const stepLabels = [
  "Admin",
  "Company",
  "Organization",
  "Payroll",
  "Attendance",
  "Leave",
  "Holidays",
  "Loans",
  "Compensation",
  "Statutory",
  "Access Policy",
] as const

const fieldLabelByPath: Record<string, string> = {
  "admin.firstName": "Admin first name",
  "admin.lastName": "Admin last name",
  "admin.username": "Admin username",
  "admin.email": "Admin email",
  "company.name": "Company name",
  "company.code": "Company code",
  "company.fiscalYearStartMonth": "Fiscal start month",
  "attendance.workSchedule.saturdayHalfDay.startTime": "Saturday start time",
  "attendance.workSchedule.saturdayHalfDay.endTime": "Saturday end time",
  "attendance.workSchedule.saturdayHalfDay.requiredHours": "Saturday required hours",
}

const defaultDraft: SetupDraftInput = {
  admin: {
    firstName: "",
    lastName: "",
    username: "",
    email: "",
  },
  company: {
    name: "",
    code: "",
    legalName: "",
    tin: "",
    rdoCode: "",
    secDtiNumber: "",
    sssEmployerNumber: "",
    philHealthEmployerNumber: "",
    pagIbigEmployerNumber: "",
    minimumWageRegion: "",
    fiscalYearStartMonth: 1,
    defaultCurrency: "PHP",
  },
  organization: {
    department: { code: "ADMIN", name: "Administration" },
    position: { code: "SUPER_ADMIN", name: "Super Admin" },
    branch: { code: "MAIN", name: "Main Branch" },
    division: { code: "CORP", name: "Corporate" },
    rank: { code: "R1", name: "Rank 1" },
  },
  payroll: {
    payPeriodPattern: {
      code: "SEMI_MONTHLY_DEFAULT",
      name: "Semi-Monthly Default",
      payFrequencyCode: "SEMI_MONTHLY",
    },
  },
  attendance: {
    workSchedule: {
      code: "REG_DAY",
      name: "Regular Day Shift",
      workStartTime: "08:00",
      workEndTime: "17:00",
      breakStartTime: "12:00",
      breakEndTime: "13:00",
      breakDurationMins: 60,
      gracePeriodMins: 10,
      requiredHoursPerDay: 8,
      restDays: ["SATURDAY", "SUNDAY"],
      saturdayHalfDay: {
        enabled: true,
        startTime: "08:00",
        endTime: "12:00",
        requiredHours: 4,
      },
    },
    overtimeRates: [
      { overtimeTypeCode: "REGULAR_OT", rateMultiplier: 1.25 },
      { overtimeTypeCode: "REST_DAY_OT", rateMultiplier: 1.3 },
      { overtimeTypeCode: "SPECIAL_HOLIDAY_OT", rateMultiplier: 1.3 },
      { overtimeTypeCode: "REGULAR_HOLIDAY_OT", rateMultiplier: 2.0 },
      { overtimeTypeCode: "REST_DAY_HOLIDAY_OT", rateMultiplier: 2.6 },
      { overtimeTypeCode: "NIGHT_DIFF", rateMultiplier: 0.1 },
    ],
  },
  leave: {
    leaveTypes: [
      { code: "VL", name: "Vacation Leave", annualEntitlementRegular: 10 },
      { code: "SL", name: "Sick Leave", annualEntitlementRegular: 10 },
    ],
  },
  holidays: {
    items: [
      { holidayDate: "2026-01-01", name: "New Year\'s Day", holidayTypeCode: "REGULAR", payMultiplier: 2, applicability: "NATIONWIDE", region: "" },
      { holidayDate: "2026-06-12", name: "Independence Day", holidayTypeCode: "REGULAR", payMultiplier: 2, applicability: "NATIONWIDE", region: "" },
      { holidayDate: "2026-12-25", name: "Christmas Day", holidayTypeCode: "REGULAR", payMultiplier: 2, applicability: "NATIONWIDE", region: "" },
    ],
  },
  loans: {
    loanTypes: [
      { code: "SSS_SAL", name: "SSS Salary Loan", categoryCode: "SSS", interestTypeCode: "FIXED", defaultInterestRate: 0.1, maxTermMonths: 24 },
      { code: "PAGIBIG_MPL", name: "Pag-IBIG Multi-Purpose Loan", categoryCode: "PAGIBIG", interestTypeCode: "FIXED", defaultInterestRate: 0.1, maxTermMonths: 36 },
      { code: "COMP_CA", name: "Company Cash Advance", categoryCode: "COMPANY", interestTypeCode: "ZERO", defaultInterestRate: 0, maxTermMonths: 6 },
    ],
  },
  compensation: {
    earningTypes: [
      { code: "BASIC_PAY", name: "Basic Pay", isTaxable: true, isIncludedInGross: true },
      { code: "OT_PAY", name: "Overtime Pay", isTaxable: true, isIncludedInGross: true },
    ],
    deductionTypes: [
      { code: "SSS", name: "SSS Contribution", isMandatory: true, isPreTax: true },
      { code: "PHILHEALTH", name: "PhilHealth Contribution", isMandatory: true, isPreTax: true },
      { code: "PAGIBIG", name: "Pag-IBIG Contribution", isMandatory: true, isPreTax: true },
      { code: "WHTAX", name: "Withholding Tax", isMandatory: true, isPreTax: false },
    ],
  },
  statutory: {
    sss: { version: "DEFAULT", monthlySalaryCredit: 30000, employeeShare: 1350, employerShare: 2700, ecContribution: 30 },
    philHealth: {
      version: "DEFAULT",
      premiumRate: 0.05,
      monthlyFloor: 10000,
      monthlyCeiling: 100000,
      employeeSharePercent: 0.5,
      employerSharePercent: 0.5,
    },
    pagIbig: { version: "DEFAULT", employeeRatePercent: 0.02, employerRatePercent: 0.02, maxMonthlyCompensation: 5000 },
    tax: { version: "TRAIN_DEFAULT", monthlyExemptThreshold: 20833 },
  },
  system: {
    timezone: "Asia/Manila",
    roleModulePolicy: {
      hrAdmin: { employees: true, leave: true, overtime: true, payroll: false },
      payrollAdmin: { employees: true, leave: true, overtime: true, payroll: true },
      approver: { leave: true, overtime: true },
    },
  },
}

type StepProps = {
  draft: SetupDraftInput
  setDraft: Dispatch<SetStateAction<SetupDraftInput>>
}

export function SetupWizardForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<SetupDraftInput>(defaultDraft)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const progress = useMemo(() => ((step + 1) / stepLabels.length) * 100, [step])

  const getIssueMessage = (issue: ZodIssue): string => {
    const path = issue.path.join(".")
    const label = fieldLabelByPath[path] ?? path

    if (!label) {
      return "Please review the setup details and try again."
    }

    return `Please check ${label}. ${issue.message}`
  }

  const validateCurrentStep = (): boolean => {
    const admin = draft.admin
    const company = draft.company
    const organization = draft.organization
    const payroll = draft.payroll.payPeriodPattern
    const attendance = draft.attendance
    const leave = draft.leave ?? { leaveTypes: [] }
    const holidays = draft.holidays ?? { items: [] }
    const loans = draft.loans ?? { loanTypes: [] }
    const compensation = draft.compensation ?? { earningTypes: [], deductionTypes: [] }
    const statutory = draft.statutory

    if (step === 0) {
      if (admin.firstName.trim().length < 2) return setError("Please enter a valid admin first name.")
      if (admin.lastName.trim().length < 2) return setError("Please enter a valid admin last name.")
      if (admin.username.trim().length < 4) return setError("Admin username must be at least 4 characters.")
      if (!admin.email.includes("@")) return setError("Please enter a valid admin email address.")
    }

    if (step === 1) {
      if (company.name.trim().length < 2) return setError("Please enter a valid company name.")
      if (company.code.trim().length < 3) return setError("Company code must be at least 3 characters.")
      if (company.fiscalYearStartMonth < 1 || company.fiscalYearStartMonth > 12) {
        return setError("Fiscal start month must be between 1 and 12.")
      }
    }

    if (step === 2) {
      if (organization.department.code.trim().length < 2) return setError("Department code is required.")
      if (organization.department.name.trim().length < 2) return setError("Department name is required.")
      if (organization.position.code.trim().length < 2) return setError("Position code is required.")
      if (organization.position.name.trim().length < 2) return setError("Position name is required.")
      if (organization.branch.code.trim().length < 2) return setError("Branch code is required.")
      if (organization.branch.name.trim().length < 2) return setError("Branch name is required.")
      if (organization.division.code.trim().length < 2) return setError("Division code is required.")
      if (organization.division.name.trim().length < 2) return setError("Division name is required.")
      if (organization.rank.code.trim().length < 1) return setError("Rank code is required.")
      if (organization.rank.name.trim().length < 2) return setError("Rank name is required.")
    }

    if (step === 3) {
      if (payroll.code.trim().length < 3) return setError("Pay period pattern code is required.")
      if (payroll.name.trim().length < 3) return setError("Pay period pattern name is required.")
    }

    if (step === 4) {
      if (attendance.workSchedule.code.trim().length < 2) return setError("Work schedule code is required.")
      if (attendance.workSchedule.name.trim().length < 2) return setError("Work schedule name is required.")
      if (attendance.workSchedule.saturdayHalfDay.enabled) {
        if (!attendance.workSchedule.saturdayHalfDay.startTime) return setError("Saturday half-day start time is required.")
        if (!attendance.workSchedule.saturdayHalfDay.endTime) return setError("Saturday half-day end time is required.")
        if (!attendance.workSchedule.saturdayHalfDay.requiredHours) return setError("Saturday half-day required hours is required.")
      }
      if (attendance.overtimeRates.length === 0) return setError("Add at least one overtime rate.")
    }

    if (step === 5) {
      if (leave.leaveTypes.length === 0) return setError("Add at least one leave type.")
      for (const item of leave.leaveTypes) {
        if (item.code.trim().length < 2) return setError("Each leave type needs a valid code.")
        if (item.name.trim().length < 2) return setError("Each leave type needs a valid name.")
      }
    }

    if (step === 6) {
      if (holidays.items.length === 0) return setError("Add at least one holiday.")
      for (const item of holidays.items) {
        if (item.holidayDate.trim().length < 10) return setError("Each holiday needs a valid date.")
        if (item.name.trim().length < 2) return setError("Each holiday needs a name.")
        if (item.applicability === "REGIONAL" && !item.region?.trim()) {
          return setError("Regional holidays require a region value.")
        }
      }
    }

    if (step === 7) {
      if (loans.loanTypes.length === 0) return setError("Add at least one loan type.")
      for (const item of loans.loanTypes) {
        if (item.code.trim().length < 2) return setError("Each loan type needs a valid code.")
        if (item.name.trim().length < 2) return setError("Each loan type needs a valid name.")
      }
    }

    if (step === 8) {
      if (compensation.earningTypes.length === 0) return setError("Add at least one earning type.")
      if (compensation.deductionTypes.length === 0) return setError("Add at least one deduction type.")
    }

    if (step === 9) {
      if (!statutory.sss.version.trim()) return setError("SSS version is required.")
      if (!statutory.philHealth.version.trim()) return setError("PhilHealth version is required.")
      if (!statutory.pagIbig.version.trim()) return setError("Pag-IBIG version is required.")
      if (!statutory.tax.version.trim()) return setError("Tax table version is required.")
    }

    setErrorMessage(null)
    return true
  }

  const setError = (message: string): false => {
    setErrorMessage(message)
    return false
  }

  const next = () => {
    if (!validateCurrentStep()) {
      return
    }

    setStep((current) => Math.min(current + 1, stepLabels.length - 1))
  }

  const prev = () => setStep((current) => Math.max(current - 1, 0))

  const goSummary = () => {
    const parsed = setupDraftSchema.safeParse(draft)

    if (!parsed.success) {
      const topIssue = parsed.error.issues[0]
      if (topIssue) {
        setErrorMessage(getIssueMessage(topIssue))
      } else {
        setErrorMessage("Please complete all required setup fields before review.")
      }
      return
    }

    sessionStorage.setItem(SETUP_DRAFT_STORAGE_KEY, JSON.stringify(parsed.data))
    router.push("/setup/summary")
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8 sm:px-6">
      <Card className="w-full max-w-4xl border-border/70">
        <CardHeader>
          <CardTitle>System Setup Wizard</CardTitle>
          <CardDescription>Step {step + 1} of {stepLabels.length}: {stepLabels[step]}</CardDescription>
          <div className="h-2 w-full rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <motion.section
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {step === 0 ? <AdminStep draft={draft} setDraft={setDraft} /> : null}
            {step === 1 ? <CompanyStep draft={draft} setDraft={setDraft} /> : null}
            {step === 2 ? <OrganizationStep draft={draft} setDraft={setDraft} /> : null}
            {step === 3 ? <PayrollStep draft={draft} setDraft={setDraft} /> : null}
            {step === 4 ? <AttendanceStep draft={draft} setDraft={setDraft} /> : null}
            {step === 5 ? <LeaveStep draft={draft} setDraft={setDraft} /> : null}
            {step === 6 ? <HolidaysStep draft={draft} setDraft={setDraft} /> : null}
            {step === 7 ? <LoansStep draft={draft} setDraft={setDraft} /> : null}
            {step === 8 ? <CompensationStep draft={draft} setDraft={setDraft} /> : null}
            {step === 9 ? <StatutoryStep draft={draft} setDraft={setDraft} /> : null}
            {step === 10 ? <AccessPolicyStep draft={draft} setDraft={setDraft} /> : null}
          </motion.section>

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={prev} disabled={step === 0}>
              Back
            </Button>

            {step < stepLabels.length - 1 ? (
              <Button type="button" onClick={next}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={goSummary}>
                Review Summary
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function RequiredLabel({ htmlFor, text }: { htmlFor: string; text: string }) {
  return (
    <Label htmlFor={htmlFor} className="text-[11px] uppercase tracking-[0.08em]">
      {text}
      {REQUIRED}
    </Label>
  )
}

function OptionalLabel({ htmlFor, text }: { htmlFor: string; text: string }) {
  return (
    <Label htmlFor={htmlFor} className="text-[11px] uppercase tracking-[0.08em]">
      {text}
    </Label>
  )
}

function AdminStep({ draft, setDraft }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><RequiredLabel htmlFor="adminFirstName" text="First name" /><Input id="adminFirstName" value={draft.admin.firstName} onChange={(e) => setDraft((d) => ({ ...d, admin: { ...d.admin, firstName: e.target.value } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="adminLastName" text="Last name" /><Input id="adminLastName" value={draft.admin.lastName} onChange={(e) => setDraft((d) => ({ ...d, admin: { ...d.admin, lastName: e.target.value } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="adminUsername" text="Username" /><Input id="adminUsername" value={draft.admin.username} onChange={(e) => setDraft((d) => ({ ...d, admin: { ...d.admin, username: e.target.value } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="adminEmail" text="Email" /><Input id="adminEmail" type="email" value={draft.admin.email} onChange={(e) => setDraft((d) => ({ ...d, admin: { ...d.admin, email: e.target.value } }))} /></div>
    </div>
  )
}

function CompanyStep({ draft, setDraft }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><RequiredLabel htmlFor="companyName" text="Company name" /><Input id="companyName" value={draft.company.name} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, name: e.target.value } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="companyCode" text="Company code" /><Input id="companyCode" value={draft.company.code} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, code: e.target.value.toUpperCase() } }))} /></div>
      <div className="space-y-1.5"><OptionalLabel htmlFor="companyLegalName" text="Legal name" /><Input id="companyLegalName" value={draft.company.legalName ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, legalName: e.target.value } }))} /></div>
      <div className="space-y-1.5"><OptionalLabel htmlFor="companyTin" text="TIN" /><Input id="companyTin" value={draft.company.tin ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, tin: e.target.value } }))} /></div>
      <div className="space-y-1.5"><OptionalLabel htmlFor="companyRdo" text="RDO code" /><Input id="companyRdo" value={draft.company.rdoCode ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, rdoCode: e.target.value } }))} /></div>
      <div className="space-y-1.5"><OptionalLabel htmlFor="secDtiNumber" text="SEC/DTI number" /><Input id="secDtiNumber" value={draft.company.secDtiNumber ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, secDtiNumber: e.target.value } }))} /></div>
      <div className="space-y-1.5"><OptionalLabel htmlFor="sssEmployerNumber" text="SSS employer number" /><Input id="sssEmployerNumber" value={draft.company.sssEmployerNumber ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, sssEmployerNumber: e.target.value } }))} /></div>
      <div className="space-y-1.5"><OptionalLabel htmlFor="philHealthEmployerNumber" text="PhilHealth employer number" /><Input id="philHealthEmployerNumber" value={draft.company.philHealthEmployerNumber ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, philHealthEmployerNumber: e.target.value } }))} /></div>
      <div className="space-y-1.5"><OptionalLabel htmlFor="pagIbigEmployerNumber" text="Pag-IBIG employer number" /><Input id="pagIbigEmployerNumber" value={draft.company.pagIbigEmployerNumber ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, pagIbigEmployerNumber: e.target.value } }))} /></div>
      <div className="space-y-1.5"><OptionalLabel htmlFor="minimumWageRegion" text="Minimum wage region" /><Input id="minimumWageRegion" value={draft.company.minimumWageRegion ?? ""} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, minimumWageRegion: e.target.value } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="fiscalMonth" text="Fiscal start month" /><Input id="fiscalMonth" type="number" min={1} max={12} value={draft.company.fiscalYearStartMonth} onChange={(e) => setDraft((d) => ({ ...d, company: { ...d.company, fiscalYearStartMonth: Number(e.target.value) || 1 } }))} /></div>
    </div>
  )
}

function OrganizationStep({ draft, setDraft }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><RequiredLabel htmlFor="deptCode" text="Department code" /><Input id="deptCode" value={draft.organization.department.code} onChange={(e) => setDraft((d) => ({ ...d, organization: { ...d.organization, department: { ...d.organization.department, code: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="deptName" text="Department name" /><Input id="deptName" value={draft.organization.department.name} onChange={(e) => setDraft((d) => ({ ...d, organization: { ...d.organization, department: { ...d.organization.department, name: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="positionCode" text="Position code" /><Input id="positionCode" value={draft.organization.position.code} onChange={(e) => setDraft((d) => ({ ...d, organization: { ...d.organization, position: { ...d.organization.position, code: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="positionName" text="Position name" /><Input id="positionName" value={draft.organization.position.name} onChange={(e) => setDraft((d) => ({ ...d, organization: { ...d.organization, position: { ...d.organization.position, name: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="branchCode" text="Branch code" /><Input id="branchCode" value={draft.organization.branch.code} onChange={(e) => setDraft((d) => ({ ...d, organization: { ...d.organization, branch: { ...d.organization.branch, code: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="branchName" text="Branch name" /><Input id="branchName" value={draft.organization.branch.name} onChange={(e) => setDraft((d) => ({ ...d, organization: { ...d.organization, branch: { ...d.organization.branch, name: e.target.value } } }))} /></div>
    </div>
  )
}

function PayrollStep({ draft, setDraft }: StepProps) {
  const pattern = draft.payroll.payPeriodPattern
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><RequiredLabel htmlFor="patternCode" text="Pattern code" /><Input id="patternCode" value={pattern.code} onChange={(e) => setDraft((d) => ({ ...d, payroll: { payPeriodPattern: { ...d.payroll.payPeriodPattern, code: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="patternName" text="Pattern name" /><Input id="patternName" value={pattern.name} onChange={(e) => setDraft((d) => ({ ...d, payroll: { payPeriodPattern: { ...d.payroll.payPeriodPattern, name: e.target.value } } }))} /></div>
    </div>
  )
}

function AttendanceStep({ draft, setDraft }: StepProps) {
  const schedule = draft.attendance.workSchedule
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><RequiredLabel htmlFor="schedCode" text="Schedule code" /><Input id="schedCode" value={schedule.code} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, code: e.target.value } } }))} /></div>
        <div className="space-y-1.5"><RequiredLabel htmlFor="schedName" text="Schedule name" /><Input id="schedName" value={schedule.name} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, name: e.target.value } } }))} /></div>
        <div className="space-y-1.5"><RequiredLabel htmlFor="startTime" text="Work start (HH:mm)" /><Input id="startTime" value={schedule.workStartTime} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, workStartTime: e.target.value } } }))} /></div>
        <div className="space-y-1.5"><RequiredLabel htmlFor="endTime" text="Work end (HH:mm)" /><Input id="endTime" value={schedule.workEndTime} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, workEndTime: e.target.value } } }))} /></div>
        <div className="space-y-1.5"><RequiredLabel htmlFor="grace" text="Grace mins" /><Input id="grace" type="number" value={schedule.gracePeriodMins} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, gracePeriodMins: Number(e.target.value) || 0 } } }))} /></div>
        <div className="space-y-1.5"><RequiredLabel htmlFor="hours" text="Hours per day" /><Input id="hours" type="number" step="0.5" value={schedule.requiredHoursPerDay} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, requiredHoursPerDay: Number(e.target.value) || 8 } } }))} /></div>
      </div>

      <div className="rounded-md border border-border/60 p-3">
        <Label htmlFor="satEnabled" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em]">
          <input
            id="satEnabled"
            type="checkbox"
            checked={schedule.saturdayHalfDay.enabled}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                attendance: {
                  ...d.attendance,
                  workSchedule: {
                    ...schedule,
                    saturdayHalfDay: { ...schedule.saturdayHalfDay, enabled: e.target.checked },
                  },
                },
              }))
            }
          />
          Enable Saturday half-day schedule
        </Label>

        {schedule.saturdayHalfDay.enabled ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><RequiredLabel htmlFor="satStart" text="Saturday start" /><Input id="satStart" value={schedule.saturdayHalfDay.startTime ?? ""} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, saturdayHalfDay: { ...schedule.saturdayHalfDay, startTime: e.target.value } } } }))} /></div>
              <div className="space-y-1.5"><RequiredLabel htmlFor="satEnd" text="Saturday end" /><Input id="satEnd" value={schedule.saturdayHalfDay.endTime ?? ""} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, saturdayHalfDay: { ...schedule.saturdayHalfDay, endTime: e.target.value } } } }))} /></div>
              <div className="space-y-1.5"><RequiredLabel htmlFor="satHours" text="Saturday hours" /><Input id="satHours" type="number" step="0.5" value={schedule.saturdayHalfDay.requiredHours ?? 4} onChange={(e) => setDraft((d) => ({ ...d, attendance: { ...d.attendance, workSchedule: { ...schedule, saturdayHalfDay: { ...schedule.saturdayHalfDay, requiredHours: Number(e.target.value) || 4 } } } }))} /></div>
            </div>
          ) : null}
      </div>

      <div className="space-y-3 rounded-md border border-border/60 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Overtime Rates</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                attendance: {
                  ...d.attendance,
                  overtimeRates: [...d.attendance.overtimeRates, { overtimeTypeCode: "REGULAR_OT", rateMultiplier: 1.25 }],
                },
              }))
            }
          >
            Add rate
          </Button>
        </div>

        {draft.attendance.overtimeRates.map((rate, index) => (
          <div key={`${rate.overtimeTypeCode}-${index}`} className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <RequiredLabel htmlFor={`ot-type-${index}`} text="OT type" />
              <select
                id={`ot-type-${index}`}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={rate.overtimeTypeCode}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    attendance: {
                      ...d.attendance,
                      overtimeRates: d.attendance.overtimeRates.map((r, i) =>
                        i === index ? { ...r, overtimeTypeCode: e.target.value as typeof r.overtimeTypeCode } : r
                      ),
                    },
                  }))
                }
              >
                <option value="REGULAR_OT">REGULAR_OT</option>
                <option value="REST_DAY_OT">REST_DAY_OT</option>
                <option value="SPECIAL_HOLIDAY_OT">SPECIAL_HOLIDAY_OT</option>
                <option value="REGULAR_HOLIDAY_OT">REGULAR_HOLIDAY_OT</option>
                <option value="REST_DAY_HOLIDAY_OT">REST_DAY_HOLIDAY_OT</option>
                <option value="NIGHT_DIFF">NIGHT_DIFF</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <RequiredLabel htmlFor={`ot-mult-${index}`} text="Multiplier" />
              <Input
                id={`ot-mult-${index}`}
                type="number"
                step="0.01"
                value={rate.rateMultiplier}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    attendance: {
                      ...d.attendance,
                      overtimeRates: d.attendance.overtimeRates.map((r, i) =>
                        i === index ? { ...r, rateMultiplier: Number(e.target.value) || 0 } : r
                      ),
                    },
                  }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.attendance.overtimeRates.length <= 1}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    attendance: {
                      ...d.attendance,
                      overtimeRates: d.attendance.overtimeRates.filter((_, i) => i !== index),
                    },
                  }))
                }
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LeaveStep({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Set annual leave entitlement for regular employees. Probationary leave entitlement is not configured in
        setup and defaults to not entitled.
      </p>

      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              leave: {
                leaveTypes: [
                  ...d.leave.leaveTypes,
                  {
                    code: `LT${d.leave.leaveTypes.length + 1}`,
                    name: "New Leave Type",
                    annualEntitlementRegular: 0,
                  },
                ],
              },
            }))
          }
        >
          Add leave type
        </Button>
      </div>

      {draft.leave.leaveTypes.map((item, index) => (
        <div key={`${item.code}-${index}`} className="grid gap-3 rounded-md border border-border/60 p-3 sm:grid-cols-3">
          <div className="space-y-1.5"><RequiredLabel htmlFor={`leave-code-${index}`} text="Code" /><Input id={`leave-code-${index}`} value={item.code} onChange={(e) => setDraft((d) => ({ ...d, leave: { leaveTypes: d.leave.leaveTypes.map((l, i) => i === index ? { ...l, code: e.target.value } : l) } }))} /></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`leave-name-${index}`} text="Name" /><Input id={`leave-name-${index}`} value={item.name} onChange={(e) => setDraft((d) => ({ ...d, leave: { leaveTypes: d.leave.leaveTypes.map((l, i) => i === index ? { ...l, name: e.target.value } : l) } }))} /></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`leave-days-reg-${index}`} text="Annual days (regular)" /><Input id={`leave-days-reg-${index}`} type="number" value={item.annualEntitlementRegular ?? 0} onChange={(e) => setDraft((d) => ({ ...d, leave: { leaveTypes: d.leave.leaveTypes.map((l, i) => i === index ? { ...l, annualEntitlementRegular: Number(e.target.value) || 0 } : l) } }))} /></div>
          <div className="flex items-end sm:col-span-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draft.leave.leaveTypes.length <= 1}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  leave: {
                    leaveTypes: d.leave.leaveTypes.filter((_, i) => i !== index),
                  },
                }))
              }
            >
              Remove leave type
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function HolidaysStep({ draft, setDraft }: StepProps) {
  const holidayItems = draft.holidays?.items ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              holidays: {
                items: [
                  ...(d.holidays?.items ?? []),
                  {
                    holidayDate: "2026-01-01",
                    name: "New Holiday",
                    holidayTypeCode: "COMPANY",
                    payMultiplier: 1,
                    applicability: "COMPANY",
                    region: "",
                  },
                ],
              },
            }))
          }
        >
          Add holiday
        </Button>
      </div>

      {holidayItems.map((item, index) => (
        <div key={`${item.name}-${index}`} className="grid gap-3 rounded-md border border-border/60 p-3 sm:grid-cols-2">
          <div className="space-y-1.5"><RequiredLabel htmlFor={`holiday-date-${index}`} text="Date" /><Input id={`holiday-date-${index}`} type="date" value={item.holidayDate} onChange={(e) => setDraft((d) => ({ ...d, holidays: { items: (d.holidays?.items ?? []).map((h, i) => i === index ? { ...h, holidayDate: e.target.value } : h) } }))} /></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`holiday-name-${index}`} text="Name" /><Input id={`holiday-name-${index}`} value={item.name} onChange={(e) => setDraft((d) => ({ ...d, holidays: { items: (d.holidays?.items ?? []).map((h, i) => i === index ? { ...h, name: e.target.value } : h) } }))} /></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`holiday-type-${index}`} text="Type" /><select id={`holiday-type-${index}`} className="h-7 w-full rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed outline-none" value={item.holidayTypeCode} onChange={(e) => setDraft((d) => ({ ...d, holidays: { items: (d.holidays?.items ?? []).map((h, i) => i === index ? { ...h, holidayTypeCode: e.target.value as typeof h.holidayTypeCode } : h) } }))}><option value="REGULAR">REGULAR</option><option value="SPECIAL_NON_WORKING">SPECIAL_NON_WORKING</option><option value="SPECIAL_WORKING">SPECIAL_WORKING</option><option value="LOCAL">LOCAL</option><option value="COMPANY">COMPANY</option><option value="ONE_TIME">ONE_TIME</option></select></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`holiday-multiplier-${index}`} text="Pay multiplier" /><Input id={`holiday-multiplier-${index}`} type="number" step="0.01" value={item.payMultiplier} onChange={(e) => setDraft((d) => ({ ...d, holidays: { items: (d.holidays?.items ?? []).map((h, i) => i === index ? { ...h, payMultiplier: Number(e.target.value) || 1 } : h) } }))} /></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`holiday-app-${index}`} text="Applicability" /><select id={`holiday-app-${index}`} className="h-7 w-full rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed outline-none" value={item.applicability} onChange={(e) => setDraft((d) => ({ ...d, holidays: { items: (d.holidays?.items ?? []).map((h, i) => i === index ? { ...h, applicability: e.target.value as typeof h.applicability } : h) } }))}><option value="NATIONWIDE">NATIONWIDE</option><option value="REGIONAL">REGIONAL</option><option value="COMPANY">COMPANY</option></select></div>
          <div className="space-y-1.5"><OptionalLabel htmlFor={`holiday-region-${index}`} text="Region" /><Input id={`holiday-region-${index}`} value={item.region ?? ""} onChange={(e) => setDraft((d) => ({ ...d, holidays: { items: (d.holidays?.items ?? []).map((h, i) => i === index ? { ...h, region: e.target.value } : h) } }))} /></div>
          <div className="sm:col-span-2 flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={holidayItems.length <= 1}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  holidays: {
                    items: (d.holidays?.items ?? []).filter((_, i) => i !== index),
                  },
                }))
              }
            >
              Remove holiday
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function LoansStep({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              loans: {
                loanTypes: [
                  ...d.loans.loanTypes,
                  {
                    code: `LOAN${d.loans.loanTypes.length + 1}`,
                    name: "New Loan Type",
                    categoryCode: "COMPANY",
                    interestTypeCode: "FIXED",
                    defaultInterestRate: 0.05,
                    maxTermMonths: 12,
                  },
                ],
              },
            }))
          }
        >
          Add loan type
        </Button>
      </div>

      {draft.loans.loanTypes.map((item, index) => (
        <div key={`${item.code}-${index}`} className="grid gap-3 rounded-md border border-border/60 p-3 sm:grid-cols-3">
          <div className="space-y-1.5"><RequiredLabel htmlFor={`loan-code-${index}`} text="Code" /><Input id={`loan-code-${index}`} value={item.code} onChange={(e) => setDraft((d) => ({ ...d, loans: { loanTypes: d.loans.loanTypes.map((l, i) => i === index ? { ...l, code: e.target.value } : l) } }))} /></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`loan-name-${index}`} text="Name" /><Input id={`loan-name-${index}`} value={item.name} onChange={(e) => setDraft((d) => ({ ...d, loans: { loanTypes: d.loans.loanTypes.map((l, i) => i === index ? { ...l, name: e.target.value } : l) } }))} /></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`loan-category-${index}`} text="Category" /><select id={`loan-category-${index}`} className="h-7 w-full rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed outline-none" value={item.categoryCode} onChange={(e) => setDraft((d) => ({ ...d, loans: { loanTypes: d.loans.loanTypes.map((l, i) => i === index ? { ...l, categoryCode: e.target.value as typeof l.categoryCode } : l) } }))}><option value="SSS">SSS</option><option value="PAGIBIG">PAGIBIG</option><option value="COMPANY">COMPANY</option><option value="CASH_ADVANCE">CASH_ADVANCE</option></select></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`loan-interest-type-${index}`} text="Interest type" /><select id={`loan-interest-type-${index}`} className="h-7 w-full rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed outline-none" value={item.interestTypeCode} onChange={(e) => setDraft((d) => ({ ...d, loans: { loanTypes: d.loans.loanTypes.map((l, i) => i === index ? { ...l, interestTypeCode: e.target.value as typeof l.interestTypeCode } : l) } }))}><option value="FIXED">FIXED</option><option value="DIMINISHING">DIMINISHING</option><option value="ZERO">ZERO</option></select></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`loan-interest-rate-${index}`} text="Interest rate" /><Input id={`loan-interest-rate-${index}`} type="number" step="0.0001" value={item.defaultInterestRate} onChange={(e) => setDraft((d) => ({ ...d, loans: { loanTypes: d.loans.loanTypes.map((l, i) => i === index ? { ...l, defaultInterestRate: Number(e.target.value) || 0 } : l) } }))} /></div>
          <div className="space-y-1.5"><RequiredLabel htmlFor={`loan-term-${index}`} text="Max term months" /><Input id={`loan-term-${index}`} type="number" value={item.maxTermMonths} onChange={(e) => setDraft((d) => ({ ...d, loans: { loanTypes: d.loans.loanTypes.map((l, i) => i === index ? { ...l, maxTermMonths: Number(e.target.value) || 1 } : l) } }))} /></div>
          <div className="sm:col-span-3 flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draft.loans.loanTypes.length <= 1}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  loans: {
                    loanTypes: d.loans.loanTypes.filter((_, i) => i !== index),
                  },
                }))
              }
            >
              Remove loan type
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function CompensationStep({ draft, setDraft }: StepProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-md border border-border/60 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Earning Types</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                compensation: {
                  ...d.compensation,
                  earningTypes: [
                    ...d.compensation.earningTypes,
                    { code: `EARN${d.compensation.earningTypes.length + 1}`, name: "New Earning", isTaxable: true, isIncludedInGross: true },
                  ],
                },
              }))
            }
          >
            Add earning type
          </Button>
        </div>

        {draft.compensation.earningTypes.map((item, index) => (
          <div key={`${item.code}-${index}`} className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-1.5"><RequiredLabel htmlFor={`earn-code-${index}`} text="Code" /><Input id={`earn-code-${index}`} value={item.code} onChange={(e) => setDraft((d) => ({ ...d, compensation: { ...d.compensation, earningTypes: d.compensation.earningTypes.map((r, i) => i === index ? { ...r, code: e.target.value } : r) } }))} /></div>
            <div className="space-y-1.5"><RequiredLabel htmlFor={`earn-name-${index}`} text="Name" /><Input id={`earn-name-${index}`} value={item.name} onChange={(e) => setDraft((d) => ({ ...d, compensation: { ...d.compensation, earningTypes: d.compensation.earningTypes.map((r, i) => i === index ? { ...r, name: e.target.value } : r) } }))} /></div>
            <div className="space-y-1.5">
              <OptionalLabel htmlFor={`earn-taxable-${index}`} text="Taxable" />
              <Label htmlFor={`earn-taxable-${index}`} className="inline-flex h-7 items-center gap-2 rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed">
                <input id={`earn-taxable-${index}`} type="checkbox" checked={item.isTaxable} onChange={(e) => setDraft((d) => ({ ...d, compensation: { ...d.compensation, earningTypes: d.compensation.earningTypes.map((r, i) => i === index ? { ...r, isTaxable: e.target.checked } : r) } }))} />
                Enabled
              </Label>
            </div>
            <div className="space-y-1.5">
              <OptionalLabel htmlFor={`earn-gross-${index}`} text="In gross" />
              <Label htmlFor={`earn-gross-${index}`} className="inline-flex h-7 items-center gap-2 rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed">
                <input id={`earn-gross-${index}`} type="checkbox" checked={item.isIncludedInGross} onChange={(e) => setDraft((d) => ({ ...d, compensation: { ...d.compensation, earningTypes: d.compensation.earningTypes.map((r, i) => i === index ? { ...r, isIncludedInGross: e.target.checked } : r) } }))} />
                Enabled
              </Label>
            </div>
            <div className="space-y-1.5 sm:justify-self-end">
              <OptionalLabel htmlFor={`earn-remove-${index}`} text="Actions" />
              <Button id={`earn-remove-${index}`} type="button" variant="outline" size="sm" className="h-7 gap-1.5" disabled={draft.compensation.earningTypes.length <= 1} onClick={() => setDraft((d) => ({ ...d, compensation: { ...d.compensation, earningTypes: d.compensation.earningTypes.filter((_, i) => i !== index) } }))}><IconTrash className="size-3.5" />Remove</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-md border border-border/60 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Deduction Types</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                compensation: {
                  ...d.compensation,
                  deductionTypes: [
                    ...d.compensation.deductionTypes,
                    { code: `DED${d.compensation.deductionTypes.length + 1}`, name: "New Deduction", isMandatory: false, isPreTax: true },
                  ],
                },
              }))
            }
          >
            Add deduction type
          </Button>
        </div>

        {draft.compensation.deductionTypes.map((item, index) => (
          <div key={`${item.code}-${index}`} className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-1.5"><RequiredLabel htmlFor={`ded-code-${index}`} text="Code" /><Input id={`ded-code-${index}`} value={item.code} onChange={(e) => setDraft((d) => ({ ...d, compensation: { ...d.compensation, deductionTypes: d.compensation.deductionTypes.map((r, i) => i === index ? { ...r, code: e.target.value } : r) } }))} /></div>
            <div className="space-y-1.5"><RequiredLabel htmlFor={`ded-name-${index}`} text="Name" /><Input id={`ded-name-${index}`} value={item.name} onChange={(e) => setDraft((d) => ({ ...d, compensation: { ...d.compensation, deductionTypes: d.compensation.deductionTypes.map((r, i) => i === index ? { ...r, name: e.target.value } : r) } }))} /></div>
            <div className="space-y-1.5">
              <OptionalLabel htmlFor={`ded-mandatory-${index}`} text="Mandatory" />
              <Label htmlFor={`ded-mandatory-${index}`} className="inline-flex h-7 items-center gap-2 rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed">
                <input id={`ded-mandatory-${index}`} type="checkbox" checked={item.isMandatory} onChange={(e) => setDraft((d) => ({ ...d, compensation: { ...d.compensation, deductionTypes: d.compensation.deductionTypes.map((r, i) => i === index ? { ...r, isMandatory: e.target.checked } : r) } }))} />
                Enabled
              </Label>
            </div>
            <div className="space-y-1.5">
              <OptionalLabel htmlFor={`ded-pretax-${index}`} text="Pre-tax" />
              <Label htmlFor={`ded-pretax-${index}`} className="inline-flex h-7 items-center gap-2 rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed">
                <input id={`ded-pretax-${index}`} type="checkbox" checked={item.isPreTax} onChange={(e) => setDraft((d) => ({ ...d, compensation: { ...d.compensation, deductionTypes: d.compensation.deductionTypes.map((r, i) => i === index ? { ...r, isPreTax: e.target.checked } : r) } }))} />
                Enabled
              </Label>
            </div>
            <div className="space-y-1.5 sm:justify-self-end">
              <OptionalLabel htmlFor={`ded-remove-${index}`} text="Actions" />
              <Button id={`ded-remove-${index}`} type="button" variant="outline" size="sm" className="h-7 gap-1.5" disabled={draft.compensation.deductionTypes.length <= 1} onClick={() => setDraft((d) => ({ ...d, compensation: { ...d.compensation, deductionTypes: d.compensation.deductionTypes.filter((_, i) => i !== index) } }))}><IconTrash className="size-3.5" />Remove</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatutoryStep({ draft, setDraft }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><RequiredLabel htmlFor="sssVersion" text="SSS version" /><Input id="sssVersion" value={draft.statutory.sss.version} onChange={(e) => setDraft((d) => ({ ...d, statutory: { ...d.statutory, sss: { ...d.statutory.sss, version: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="phVersion" text="PhilHealth version" /><Input id="phVersion" value={draft.statutory.philHealth.version} onChange={(e) => setDraft((d) => ({ ...d, statutory: { ...d.statutory, philHealth: { ...d.statutory.philHealth, version: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="pagibigVersion" text="Pag-IBIG version" /><Input id="pagibigVersion" value={draft.statutory.pagIbig.version} onChange={(e) => setDraft((d) => ({ ...d, statutory: { ...d.statutory, pagIbig: { ...d.statutory.pagIbig, version: e.target.value } } }))} /></div>
      <div className="space-y-1.5"><RequiredLabel htmlFor="taxVersion" text="Tax table version" /><Input id="taxVersion" value={draft.statutory.tax.version} onChange={(e) => setDraft((d) => ({ ...d, statutory: { ...d.statutory, tax: { ...d.statutory.tax, version: e.target.value } } }))} /></div>
    </div>
  )
}

function AccessPolicyStep({ draft, setDraft }: StepProps) {
  const setFlag = (
    role: "hrAdmin" | "payrollAdmin" | "approver",
    key: string,
    checked: boolean
  ) => {
    setDraft((d) => ({
      ...d,
      system: {
        ...d.system,
        roleModulePolicy: {
          ...d.system.roleModulePolicy,
          [role]: {
            ...d.system.roleModulePolicy[role],
            [key]: checked,
          },
        },
      },
    }))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure baseline module permissions for company-scoped roles.</p>
      <div className="grid gap-3 rounded-md border border-border/60 p-3">
        <p className="font-medium text-sm">HR Admin</p>
        {(["employees", "leave", "overtime", "payroll"] as const).map((moduleKey) => (
          <Label key={`hr-${moduleKey}`} className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em]">
            <input
              type="checkbox"
              checked={draft.system.roleModulePolicy.hrAdmin[moduleKey]}
              onChange={(e) => setFlag("hrAdmin", moduleKey, e.target.checked)}
            />
            {moduleKey}
          </Label>
        ))}
      </div>
      <div className="grid gap-3 rounded-md border border-border/60 p-3">
        <p className="font-medium text-sm">Payroll Admin</p>
        {(["employees", "leave", "overtime", "payroll"] as const).map((moduleKey) => (
          <Label key={`payroll-${moduleKey}`} className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em]">
            <input
              type="checkbox"
              checked={draft.system.roleModulePolicy.payrollAdmin[moduleKey]}
              onChange={(e) => setFlag("payrollAdmin", moduleKey, e.target.checked)}
            />
            {moduleKey}
          </Label>
        ))}
      </div>
      <div className="grid gap-3 rounded-md border border-border/60 p-3">
        <p className="font-medium text-sm">Approver</p>
        {(["leave", "overtime"] as const).map((moduleKey) => (
          <Label key={`approver-${moduleKey}`} className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.08em]">
            <input
              type="checkbox"
              checked={draft.system.roleModulePolicy.approver[moduleKey]}
              onChange={(e) => setFlag("approver", moduleKey, e.target.checked)}
            />
            {moduleKey}
          </Label>
        ))}
      </div>
    </div>
  )
}
