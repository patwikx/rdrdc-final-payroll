"use client"

import { useMemo, useState, useTransition } from "react"
import type { ComponentType, Dispatch, ReactNode, SetStateAction } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconAward,
  IconBriefcase,
  IconCalendar,
  IconCreditCard,
  IconFileText,
  IconFingerprint,
  IconHeart,
  IconHistory,
  IconUser,
  IconLayoutGrid,
  IconUsers,
} from "@tabler/icons-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { EmployeeFamilyTab } from "@/modules/employees/profile/components/employee-family-tab"
import { updateEmployeeProfileAction } from "@/modules/employees/profile/actions/update-employee-profile-action"
import { EmployeeHistoryTab } from "@/modules/employees/profile/components/employee-history-tab"
import { EmployeeMedicalTab } from "@/modules/employees/profile/components/employee-medical-tab"
import { EmployeeQualificationsTab } from "@/modules/employees/profile/components/employee-qualifications-tab"
import type { EmployeeProfileViewModel } from "@/modules/employees/profile/utils/get-employee-profile-data"
import { toast } from "sonner"

type EmployeeProfilePageProps = {
  data: EmployeeProfileViewModel
}

type TabKey = "overview" | "personal" | "education" | "employment" | "payroll" | "medical" | "qualifications" | "history" | "documents"

const tabs: Array<{ value: TabKey; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "overview", label: "Overview", icon: IconLayoutGrid },
  { value: "personal", label: "Personal", icon: IconFingerprint },
  { value: "education", label: "Family", icon: IconUsers },
  { value: "employment", label: "Employment", icon: IconBriefcase },
  { value: "payroll", label: "Payroll", icon: IconCreditCard },
  { value: "medical", label: "Medical", icon: IconHeart },
  { value: "qualifications", label: "Education & Trainings", icon: IconAward },
  { value: "history", label: "History", icon: IconHistory },
  { value: "documents", label: "Documents", icon: IconFileText },
]

type EmployeeProfileDraft = {
  firstName: string
  lastName: string
  middleName: string
  suffix: string
  maidenName: string
  nickname: string
  birthDate: string
  birthPlace: string
  nationality: string
  citizenship: string
  genderId: string
  civilStatusId: string
  religionId: string
  bloodTypeId: string
  heightCm: string
  weightKg: string
  mobileNumber: string
  personalEmail: string
  biometricId: string
  rfidNumber: string
  numberOfDependents: string
  previousEmployerIncome: string
  previousEmployerTaxWithheld: string
  wfhSchedule: string
  employmentStatusId: string
  employmentTypeId: string
  employmentClassId: string
  departmentId: string
  divisionId: string
  positionId: string
  rankId: string
  branchId: string
  reportingManagerId: string
  workScheduleId: string
  workStart: string
  workEnd: string
  workHours: string
  gracePeriod: string
  payPeriodPatternId: string
  taxStatusId: string
  hireDate: string
  applicationDate: string
  interviewDate: string
  jobOfferDate: string
  probationStartDate: string
  probationEndDate: string
  regularizationDate: string
  contractStartDate: string
  contractEndDate: string
  monthlyRate: string
  dailyRate: string
  hourlyRate: string
  monthlyDivisor: string
  hoursPerDay: string
  salaryGrade: string
  salaryBand: string
  minimumWageRegion: string
  tinNumber: string
  sssNumber: string
  philHealthNumber: string
  pagIbigNumber: string
  umidNumber: string
  isSubstitutedFiling: boolean
  isOvertimeEligible: boolean
  isNightDiffEligible: boolean
  isWfhEligible: boolean
}

const toPositiveNumber = (value: string): number | null => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

const toRateString = (value: number): string => value.toFixed(2)

const recalculateDerivedRates = (draft: EmployeeProfileDraft): EmployeeProfileDraft => {
  const monthlyRate = toPositiveNumber(draft.monthlyRate)
  if (!monthlyRate) {
    return {
      ...draft,
      dailyRate: "",
      hourlyRate: "",
    }
  }

  const monthlyDivisor = toPositiveNumber(draft.monthlyDivisor)
  if (!monthlyDivisor) {
    return {
      ...draft,
      dailyRate: "",
      hourlyRate: "",
    }
  }

  const dailyRate = (monthlyRate * 12) / monthlyDivisor
  const hoursPerDay = toPositiveNumber(draft.hoursPerDay)

  return {
    ...draft,
    dailyRate: toRateString(dailyRate),
    hourlyRate: hoursPerDay ? toRateString(dailyRate / hoursPerDay) : "",
  }
}

export function EmployeeProfilePage({ data }: EmployeeProfilePageProps) {
  const employee = data.employee
  const router = useRouter()
  const [isSaving, startSaving] = useTransition()
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [isEditing, setIsEditing] = useState(false)

  const initialDraft = useMemo(() => buildInitialDraft(employee), [employee])
  const [draft, setDraft] = useState<EmployeeProfileDraft>(initialDraft)

  const onCancelEdit = () => {
    setDraft(initialDraft)
    setIsEditing(false)
  }

  const onSaveEdit = () => {
    startSaving(async () => {
      const numberOfDependents = Number(draft.numberOfDependents)
      const monthlyRate = draft.monthlyRate.trim().length > 0 ? Number(draft.monthlyRate) : undefined
      const dailyRate = draft.dailyRate.trim().length > 0 ? Number(draft.dailyRate) : undefined
      const hourlyRate = draft.hourlyRate.trim().length > 0 ? Number(draft.hourlyRate) : undefined
      const monthlyDivisor = draft.monthlyDivisor.trim().length > 0 ? Number(draft.monthlyDivisor) : undefined
      const hoursPerDay = draft.hoursPerDay.trim().length > 0 ? Number(draft.hoursPerDay) : undefined
      const heightCm = draft.heightCm.trim().length > 0 ? Number(draft.heightCm) : undefined
      const weightKg = draft.weightKg.trim().length > 0 ? Number(draft.weightKg) : undefined
      const previousEmployerIncome = draft.previousEmployerIncome.trim().length > 0 ? Number(draft.previousEmployerIncome) : undefined
      const previousEmployerTaxWithheld =
        draft.previousEmployerTaxWithheld.trim().length > 0 ? Number(draft.previousEmployerTaxWithheld) : undefined

      if (Number.isNaN(numberOfDependents) || numberOfDependents < 0) {
        toast.error("Number of Dependents must be a valid non-negative number.")
        return
      }

      if (previousEmployerIncome !== undefined && Number.isNaN(previousEmployerIncome)) {
        toast.error("Previous Employer Income must be a valid number.")
        return
      }

      if (previousEmployerTaxWithheld !== undefined && Number.isNaN(previousEmployerTaxWithheld)) {
        toast.error("Previous Employer Tax Withheld must be a valid number.")
        return
      }

      if (monthlyRate !== undefined && Number.isNaN(monthlyRate)) {
        toast.error("Monthly Rate must be a valid number.")
        return
      }

      if (monthlyDivisor !== undefined && Number.isNaN(monthlyDivisor)) {
        toast.error("Monthly Divisor must be a valid number.")
        return
      }

      if (hoursPerDay !== undefined && Number.isNaN(hoursPerDay)) {
        toast.error("Hours Per Day must be a valid number.")
        return
      }

      if (dailyRate !== undefined && Number.isNaN(dailyRate)) {
        toast.error("Daily Rate must be a valid number.")
        return
      }

      if (hourlyRate !== undefined && Number.isNaN(hourlyRate)) {
        toast.error("Hourly Rate must be a valid number.")
        return
      }

      if (heightCm !== undefined && Number.isNaN(heightCm)) {
        toast.error("Height must be a valid number.")
        return
      }

      if (weightKg !== undefined && Number.isNaN(weightKg)) {
        toast.error("Weight must be a valid number.")
        return
      }

      const result = await updateEmployeeProfileAction({
        companyId: data.companyId,
        employeeId: employee.id,
        firstName: draft.firstName,
        lastName: draft.lastName,
        middleName: draft.middleName,
        suffix: draft.suffix,
        maidenName: draft.maidenName,
        nickname: draft.nickname,
        birthDate: draft.birthDate,
        birthPlace: draft.birthPlace,
        nationality: draft.nationality,
        citizenship: draft.citizenship,
        genderId: draft.genderId,
        civilStatusId: draft.civilStatusId,
        religionId: draft.religionId,
        bloodTypeId: draft.bloodTypeId,
        heightCm,
        weightKg,
        employmentStatusId: draft.employmentStatusId,
        employmentTypeId: draft.employmentTypeId,
        employmentClassId: draft.employmentClassId,
        departmentId: draft.departmentId,
        divisionId: draft.divisionId,
        positionId: draft.positionId,
        rankId: draft.rankId,
        branchId: draft.branchId,
        reportingManagerId: draft.reportingManagerId,
        workScheduleId: draft.workScheduleId,
        payPeriodPatternId: draft.payPeriodPatternId,
        taxStatusId: draft.taxStatusId,
        hireDate: draft.hireDate,
        applicationDate: draft.applicationDate,
        interviewDate: draft.interviewDate,
        jobOfferDate: draft.jobOfferDate,
        probationStartDate: draft.probationStartDate,
        probationEndDate: draft.probationEndDate,
        regularizationDate: draft.regularizationDate,
        contractStartDate: draft.contractStartDate,
        contractEndDate: draft.contractEndDate,
        mobileNumber: draft.mobileNumber,
        personalEmail: draft.personalEmail,
        biometricId: draft.biometricId,
        rfidNumber: draft.rfidNumber,
        numberOfDependents,
        previousEmployerIncome,
        previousEmployerTaxWithheld,
        monthlyRate,
        dailyRate,
        hourlyRate,
        monthlyDivisor,
        hoursPerDay,
        salaryGrade: draft.salaryGrade,
        salaryBand: draft.salaryBand,
        minimumWageRegion: draft.minimumWageRegion,
        tinNumber: draft.tinNumber,
        sssNumber: draft.sssNumber,
        philHealthNumber: draft.philHealthNumber,
        pagIbigNumber: draft.pagIbigNumber,
        umidNumber: draft.umidNumber,
        wfhSchedule: draft.wfhSchedule,
        isSubstitutedFiling: draft.isSubstitutedFiling,
        isOvertimeEligible: draft.isOvertimeEligible,
        isNightDiffEligible: draft.isNightDiffEligible,
        isWfhEligible: draft.isWfhEligible,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setIsEditing(false)
      router.refresh()
    })
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 pb-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Master Record • {employee.employeeNumber}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">{employee.lastName}, {employee.firstName}</h1>
              <Badge variant={employee.isActive ? "default" : "secondary"}>{employee.isActive ? employee.employmentStatus : "Deactivated"}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/${data.companyId}/employees`}>
              <Button variant="outline">
                <IconArrowLeft className="size-4" /> Back to Masterlist
              </Button>
            </Link>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={onCancelEdit} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={onSaveEdit} disabled={isSaving}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600"
              >
                Edit Record
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <aside className="xl:col-span-2 space-y-4">
          <div className="border border-border/60 p-1">
            <div className="aspect-square overflow-hidden bg-muted/20">
              <Avatar className="size-full !rounded-none after:!rounded-none">
                <AvatarImage src={employee.photoUrl ?? undefined} alt={employee.fullName} className="!rounded-none object-cover" />
                <AvatarFallback className="!rounded-none text-4xl font-semibold">
                  {employee.firstName[0]}
                  {employee.lastName[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border/60">
              <div className="bg-background p-3 text-center">
                <p className="text-xs text-muted-foreground">Tenure</p>
                <p className="text-sm font-semibold text-foreground">{employee.tenure}</p>
              </div>
              <div className="bg-background p-3 text-center">
                <p className="text-xs text-muted-foreground">Rate Type</p>
                <p className="text-sm font-semibold text-foreground">{employee.salaryRateType}</p>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <Quick label="Department" value={employee.department} />
              <Quick label="Position" value={employee.position} />
              <Quick label="Branch" value={employee.branch} />
              <Quick label="Supervisor" value={employee.reportingManager} />
            </CardContent>
          </Card>
        </aside>

        <section className="xl:col-span-10 space-y-6">
          <div className="-mt-2 overflow-x-auto border-b">
            <div className="inline-flex min-w-full flex-nowrap gap-0">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.value
                return (
                  <Button
                    key={tab.value}
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "px-6 text-xs font-medium uppercase tracking-wide",
                      active ? "bg-primary/5 text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4" /> {tab.label}
                  </Button>
                )
              })}
            </div>
          </div>

          {activeTab === "overview" ? <OverviewTab employee={employee} isEditing={isEditing} draft={draft} setDraft={setDraft} /> : null}
          {activeTab === "personal" ? <PersonalTab employee={employee} options={data.options} isEditing={isEditing} draft={draft} setDraft={setDraft} /> : null}
          {activeTab === "education" ? <EmployeeFamilyTab companyId={data.companyId} employee={employee} options={data.options} /> : null}
          {activeTab === "employment" ? <EmploymentTab employee={employee} options={data.options} isEditing={isEditing} draft={draft} setDraft={setDraft} /> : null}
          {activeTab === "payroll" ? <PayrollTab employee={employee} options={data.options} isEditing={isEditing} draft={draft} setDraft={setDraft} /> : null}
          {activeTab === "medical" ? <EmployeeMedicalTab companyId={data.companyId} employee={employee} /> : null}
          {activeTab === "qualifications" ? <EmployeeQualificationsTab companyId={data.companyId} employee={employee} options={data.options} /> : null}
          {activeTab === "history" ? <EmployeeHistoryTab companyId={data.companyId} employee={employee} options={data.options} /> : null}
          {activeTab === "documents" ? <DocumentsTab employee={employee} /> : null}
        </section>
      </div>
    </main>
  )
}

function OverviewTab({
  employee,
  isEditing,
  draft,
  setDraft,
}: {
  employee: EmployeeProfileViewModel["employee"]
  isEditing: boolean
  draft: EmployeeProfileDraft
  setDraft: Dispatch<SetStateAction<EmployeeProfileDraft>>
}) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric title="Base Salary" value={employee.monthlyRate} />
        <Metric title="Employee Tenure" value={employee.tenure} />
        <Metric title="Pay Scheme" value={employee.payPeriodPattern} />
        <Metric title="Status" value={employee.isActive ? "Active" : "Deactivated"} />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Button variant="outline" disabled>
          Deactivate
        </Button>
        <Button variant="outline" disabled>
          Terminate
        </Button>
      </div>

      <SectionHeader title="Designation Summary" number="01" icon={IconBriefcase} />
      <FieldGrid className="md:grid-cols-4">
        <Field label="Official Position" value={employee.position} />
        <Field label="Department" value={employee.department} />
        <Field label="Rank Level" value={employee.rank} />
        <Field label="Employment Type" value={employee.employmentType} />
      </FieldGrid>

      <SectionHeader title="Contact Channels" number="02" icon={IconUsers} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {isEditing ? <Field label="Primary Mobile" value={employee.contacts.find((row) => row.isPrimary)?.value ?? "-"} editable inputValue={draft.mobileNumber} onInputChange={(value) => setDraft((prev) => ({ ...prev, mobileNumber: value }))} /> : employee.contacts.length === 0 ? <Empty /> : employee.contacts.map((row) => <RowCard key={`${row.type}-${row.value}`} title={row.value} subtitle={row.type} meta={row.isPrimary ? "Primary" : "Secondary"} />)}
        </div>
        <div className="space-y-2">
          {isEditing ? <Field label="Primary Personal Email" value={employee.emails.find((row) => row.isPrimary)?.value ?? "-"} editable inputValue={draft.personalEmail} onInputChange={(value) => setDraft((prev) => ({ ...prev, personalEmail: value }))} /> : employee.emails.length === 0 ? <Empty /> : employee.emails.map((row) => <RowCard key={`${row.type}-${row.value}`} title={row.value} subtitle={row.type} meta={row.isPrimary ? "Primary" : "Secondary"} />)}
        </div>
      </div>

      <SectionHeader title="Addresses" number="03" icon={IconCalendar} />
      <div className="space-y-2">
        {employee.addresses.length === 0 ? <Empty /> : employee.addresses.map((row) => <RowCard key={`${row.type}-${row.line}`} title={row.line || "-"} subtitle={row.type} meta={row.isPrimary ? "Primary" : "Secondary"} />)}
      </div>

      <SectionHeader title="Separation Summary" number="04" icon={IconCalendar} />
      <FieldGrid>
        <Field label="Separation Date" value={employee.separationDate} />
        <Field label="Last Working Day" value={employee.lastWorkingDay} />
        <Field label="Separation Reason" value={employee.separationReason} />
        <Field label="Status" value={employee.isActive ? "Active" : "Deactivated"} />
      </FieldGrid>
    </div>
  )
}

function PersonalTab({
  employee,
  options,
  isEditing,
  draft,
  setDraft,
}: {
  employee: EmployeeProfileViewModel["employee"]
  options: EmployeeProfileViewModel["options"]
  isEditing: boolean
  draft: EmployeeProfileDraft
  setDraft: Dispatch<SetStateAction<EmployeeProfileDraft>>
}) {
  return (
    <div className="space-y-8">
      <SectionHeader title="Identity Information" number="01" icon={IconFingerprint} />
      <FieldGrid>
        <Field label="First Name *" value={employee.firstName} editable={isEditing} inputValue={draft.firstName} onInputChange={(value) => setDraft((prev) => ({ ...prev, firstName: value }))} />
        <Field label="Last Name *" value={employee.lastName} editable={isEditing} inputValue={draft.lastName} onInputChange={(value) => setDraft((prev) => ({ ...prev, lastName: value }))} />
        <Field label="Middle Name" value={employee.middleName} editable={isEditing} inputValue={draft.middleName} onInputChange={(value) => setDraft((prev) => ({ ...prev, middleName: value }))} />
        <Field label="Suffix" value={employee.suffix} editable={isEditing} inputValue={draft.suffix} onInputChange={(value) => setDraft((prev) => ({ ...prev, suffix: value }))} />
        <Field label="Maiden Name" value={employee.maidenName} editable={isEditing} inputValue={draft.maidenName} onInputChange={(value) => setDraft((prev) => ({ ...prev, maidenName: value }))} />
        <Field label="Nickname" value={employee.nickname} editable={isEditing} inputValue={draft.nickname} onInputChange={(value) => setDraft((prev) => ({ ...prev, nickname: value }))} />
      </FieldGrid>

      <SectionHeader title="Demographics" number="02" icon={IconUser} />
      <FieldGrid>
        <DateField label="Birth Date" value={employee.birthDate} editable={isEditing} selectedDate={draft.birthDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, birthDate: value }))} />
        <Field label="Birth Place" value={employee.birthPlace} editable={isEditing} inputValue={draft.birthPlace} onInputChange={(value) => setDraft((prev) => ({ ...prev, birthPlace: value }))} />
        <SelectField
          label="Gender"
          value={employee.gender}
          editable={isEditing}
          selectedValue={draft.genderId}
          placeholder="Select gender"
          options={options.genders}
          onValueChange={(value: string) => setDraft((prev) => ({ ...prev, genderId: value }))}
        />
        <SelectField
          label="Civil Status"
          value={employee.civilStatus}
          editable={isEditing}
          selectedValue={draft.civilStatusId}
          placeholder="Select civil status"
          options={options.civilStatuses}
          onValueChange={(value: string) => setDraft((prev) => ({ ...prev, civilStatusId: value }))}
        />
        <Field label="Nationality" value={employee.nationality} editable={isEditing} inputValue={draft.nationality} onInputChange={(value) => setDraft((prev) => ({ ...prev, nationality: value }))} />
        <SelectField
          label="Religion"
          value={employee.religion}
          editable={isEditing}
          selectedValue={draft.religionId}
          placeholder="Select religion"
          options={options.religions}
          onValueChange={(value: string) => setDraft((prev) => ({ ...prev, religionId: value }))}
        />
        <SelectField
          label="Blood Type"
          value={employee.bloodType}
          editable={isEditing}
          selectedValue={draft.bloodTypeId}
          placeholder="Select blood type"
          options={options.bloodTypes}
          onValueChange={(value: string) => setDraft((prev) => ({ ...prev, bloodTypeId: value }))}
        />
        <Field label="Citizenship" value={employee.citizenship} editable={isEditing} inputValue={draft.citizenship} onInputChange={(value) => setDraft((prev) => ({ ...prev, citizenship: value }))} />
      </FieldGrid>

      <SectionHeader title="Government IDs" number="03" icon={IconFileText} />
      <FieldGrid>
        <Field label="TIN Number" value={employee.tinNumber} editable={isEditing} inputValue={draft.tinNumber} onInputChange={(value) => setDraft((prev) => ({ ...prev, tinNumber: value }))} />
        <Field label="SSS Number" value={employee.sssNumber} editable={isEditing} inputValue={draft.sssNumber} onInputChange={(value) => setDraft((prev) => ({ ...prev, sssNumber: value }))} />
        <Field label="PhilHealth Number" value={employee.philHealthNumber} editable={isEditing} inputValue={draft.philHealthNumber} onInputChange={(value) => setDraft((prev) => ({ ...prev, philHealthNumber: value }))} />
        <Field label="Pag-IBIG Number" value={employee.pagIbigNumber} editable={isEditing} inputValue={draft.pagIbigNumber} onInputChange={(value) => setDraft((prev) => ({ ...prev, pagIbigNumber: value }))} />
        <Field label="UMID Number" value={employee.umidNumber} editable={isEditing} inputValue={draft.umidNumber} onInputChange={(value) => setDraft((prev) => ({ ...prev, umidNumber: value }))} />
      </FieldGrid>

      <SectionHeader title="Biometric Data" number="04" icon={IconCalendar} />
      <FieldGrid>
        <Field label="Height (cm)" value={employee.heightCm} editable={isEditing} inputValue={draft.heightCm} inputMode="decimal" onInputChange={(value) => setDraft((prev) => ({ ...prev, heightCm: value }))} />
        <Field label="Weight (kg)" value={employee.weightKg} editable={isEditing} inputValue={draft.weightKg} inputMode="decimal" onInputChange={(value) => setDraft((prev) => ({ ...prev, weightKg: value }))} />
        <Field label="Biometric ID" value={employee.biometricId} editable={isEditing} inputValue={draft.biometricId} onInputChange={(value) => setDraft((prev) => ({ ...prev, biometricId: value }))} />
        <Field label="RFID Number" value={employee.rfidNumber} editable={isEditing} inputValue={draft.rfidNumber} onInputChange={(value) => setDraft((prev) => ({ ...prev, rfidNumber: value }))} />
      </FieldGrid>
    </div>
  )
}

function EmploymentTab({
  employee,
  options,
  isEditing,
  draft,
  setDraft,
}: {
  employee: EmployeeProfileViewModel["employee"]
  options: EmployeeProfileViewModel["options"]
  isEditing: boolean
  draft: EmployeeProfileDraft
  setDraft: Dispatch<SetStateAction<EmployeeProfileDraft>>
}) {
  return (
    <div className="space-y-8">
      <SectionHeader title="Employment Details" number="01" icon={IconBriefcase} />
      <FieldGrid className="md:grid-cols-3 xl:grid-cols-5">
        <Field label="Employee Number" value={employee.employeeNumber} />
        <SelectField label="Employment Status" value={employee.employmentStatus} editable={isEditing} selectedValue={draft.employmentStatusId} options={options.employmentStatuses} placeholder="Select status" onValueChange={(value) => setDraft((prev) => ({ ...prev, employmentStatusId: value }))} />
        <SelectField label="Employment Class" value={employee.employmentClass} editable={isEditing} selectedValue={draft.employmentClassId} options={options.employmentClasses} placeholder="Select class" onValueChange={(value) => setDraft((prev) => ({ ...prev, employmentClassId: value }))} />
        <SelectField label="Employment Type" value={employee.employmentType} editable={isEditing} selectedValue={draft.employmentTypeId} options={options.employmentTypes} placeholder="Select type" onValueChange={(value) => setDraft((prev) => ({ ...prev, employmentTypeId: value }))} />
        <SelectField label="Department" value={employee.department} editable={isEditing} selectedValue={draft.departmentId} options={options.departments} placeholder="Select department" onValueChange={(value) => setDraft((prev) => ({ ...prev, departmentId: value }))} />
        <SelectField label="Division" value={employee.division} editable={isEditing} selectedValue={draft.divisionId} options={options.divisions} placeholder="Select division" onValueChange={(value) => setDraft((prev) => ({ ...prev, divisionId: value }))} />
        <SelectField label="Position" value={employee.position} editable={isEditing} selectedValue={draft.positionId} options={options.positions} placeholder="Select position" onValueChange={(value) => setDraft((prev) => ({ ...prev, positionId: value }))} />
        <SelectField label="Branch" value={employee.branch} editable={isEditing} selectedValue={draft.branchId} options={options.branches} placeholder="Select branch" onValueChange={(value) => setDraft((prev) => ({ ...prev, branchId: value }))} />
        <SelectField label="Rank" value={employee.rank} editable={isEditing} selectedValue={draft.rankId} options={options.ranks} placeholder="Select rank" onValueChange={(value) => setDraft((prev) => ({ ...prev, rankId: value }))} />
        <SelectField label="Reporting Manager" value={employee.reportingManager} editable={isEditing} selectedValue={draft.reportingManagerId} options={options.managers} placeholder="Select manager" onValueChange={(value) => setDraft((prev) => ({ ...prev, reportingManagerId: value }))} />
      </FieldGrid>

      <SectionHeader title="Important Dates" number="02" icon={IconCalendar} />
      <FieldGrid>
        <DateField label="Hire Date" value={employee.hireDate} editable={isEditing} selectedDate={draft.hireDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, hireDate: value }))} />
        <DateField label="Application Date" value={employee.applicationDate} editable={isEditing} selectedDate={draft.applicationDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, applicationDate: value }))} />
        <DateField label="Interview Date" value={employee.interviewDate} editable={isEditing} selectedDate={draft.interviewDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, interviewDate: value }))} />
        <DateField label="Job Offer Date" value={employee.jobOfferDate} editable={isEditing} selectedDate={draft.jobOfferDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, jobOfferDate: value }))} />
        <DateField label="Probation Start" value={employee.probationStartDate} editable={isEditing} selectedDate={draft.probationStartDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, probationStartDate: value }))} />
        <DateField label="Probation End" value={employee.probationEndDate} editable={isEditing} selectedDate={draft.probationEndDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, probationEndDate: value }))} />
        <DateField label="Regularization Date" value={employee.regularizationDate} editable={isEditing} selectedDate={draft.regularizationDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, regularizationDate: value }))} />
        <DateField label="Contract Start" value={employee.contractStartDate} editable={isEditing} selectedDate={draft.contractStartDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, contractStartDate: value }))} />
        <DateField label="Contract End" value={employee.contractEndDate} editable={isEditing} selectedDate={draft.contractEndDate} onDateChange={(value: string) => setDraft((prev) => ({ ...prev, contractEndDate: value }))} />
      </FieldGrid>

      <SectionHeader title="Work Schedule" number="03" icon={IconCalendar} />
      <FieldGrid>
        <SelectField
          label="Schedule"
          value={employee.workSchedule}
          editable={isEditing}
          selectedValue={draft.workScheduleId}
          options={options.workSchedules}
          placeholder="Select schedule"
          onValueChange={(value) => {
            setDraft((prev) => {
              const selected = options.workSchedules.find((item) => item.id === value)
              if (!selected) return { ...prev, workScheduleId: value }

              return {
                ...prev,
                workScheduleId: value,
                workStart: selected.workStart,
                workEnd: selected.workEnd,
                workHours: selected.hoursPerDay,
                gracePeriod: selected.gracePeriod,
                hoursPerDay: selected.hoursPerDay,
              }
            })
          }}
        />
        <Field label="Work Start" value={isEditing ? draft.workStart : employee.workStart} />
        <Field label="Work End" value={isEditing ? draft.workEnd : employee.workEnd} />
        <Field label="Hours Per Day" value={isEditing ? draft.workHours : employee.workHours} />
        <Field label="Grace Period" value={isEditing ? draft.gracePeriod : employee.gracePeriod} />
        <SelectField label="Pay Pattern" value={employee.payPeriodPattern} editable={isEditing} selectedValue={draft.payPeriodPatternId} options={options.payPeriodPatterns} placeholder="Select pay pattern" onValueChange={(value) => setDraft((prev) => ({ ...prev, payPeriodPatternId: value }))} />
      </FieldGrid>
    </div>
  )
}

function PayrollTab({
  employee,
  options,
  isEditing,
  draft,
  setDraft,
}: {
  employee: EmployeeProfileViewModel["employee"]
  options: EmployeeProfileViewModel["options"]
  isEditing: boolean
  draft: EmployeeProfileDraft
  setDraft: Dispatch<SetStateAction<EmployeeProfileDraft>>
}) {
  return (
    <div className="space-y-8">
      <SectionHeader title="Salary Information" number="01" icon={IconCreditCard} />
      <FieldGrid>
        <Field
          label="Base Salary"
          value={employee.monthlyRate}
          editable={isEditing}
          inputValue={draft.monthlyRate}
          inputMode="decimal"
          onInputChange={(value) =>
            setDraft((prev) => recalculateDerivedRates({ ...prev, monthlyRate: value }))
          }
        />
        <Field label="Currency" value={employee.currency} />
        <Field label="Rate Type" value={employee.salaryRateType} />
        <Field label="Daily Rate" value={employee.dailyRate} editable={isEditing} inputValue={draft.dailyRate} inputMode="decimal" onInputChange={(value) => setDraft((prev) => ({ ...prev, dailyRate: value }))} />
        <Field label="Hourly Rate" value={employee.hourlyRate} editable={isEditing} inputValue={draft.hourlyRate} inputMode="decimal" onInputChange={(value) => setDraft((prev) => ({ ...prev, hourlyRate: value }))} />
        <Field
          label="Monthly Divisor"
          value={employee.monthlyDivisor}
          editable={isEditing}
          inputValue={draft.monthlyDivisor}
          inputMode="numeric"
          onInputChange={(value) =>
            setDraft((prev) => recalculateDerivedRates({ ...prev, monthlyDivisor: value }))
          }
        />
        <Field
          label="Hours Per Day"
          value={employee.hoursPerDay}
          editable={isEditing}
          inputValue={draft.hoursPerDay}
          inputMode="decimal"
          onInputChange={(value) =>
            setDraft((prev) => recalculateDerivedRates({ ...prev, hoursPerDay: value }))
          }
        />
        <Field label="Salary Grade" value={employee.salaryGrade} editable={isEditing} inputValue={draft.salaryGrade} onInputChange={(value) => setDraft((prev) => ({ ...prev, salaryGrade: value }))} />
        <Field label="Salary Band" value={employee.salaryBand} editable={isEditing} inputValue={draft.salaryBand} onInputChange={(value) => setDraft((prev) => ({ ...prev, salaryBand: value }))} />
        <Field label="Minimum Wage Region" value={employee.minimumWageRegion} editable={isEditing} inputValue={draft.minimumWageRegion} onInputChange={(value) => setDraft((prev) => ({ ...prev, minimumWageRegion: value }))} />
      </FieldGrid>

      <SectionHeader title="Tax Settings" number="02" icon={IconFileText} />
      <FieldGrid>
        <SelectField
          label="Tax Status"
          value={employee.taxStatus}
          editable={isEditing}
          selectedValue={draft.taxStatusId}
          placeholder="Select tax status"
          options={options.taxStatuses}
          onValueChange={(value: string) => setDraft((prev) => ({ ...prev, taxStatusId: value }))}
        />
        <Field label="Number of Dependents" value={employee.dependentsCount} editable={isEditing} inputValue={draft.numberOfDependents} inputMode="numeric" onInputChange={(value) => setDraft((prev) => ({ ...prev, numberOfDependents: value }))} />
        <ToggleField label="Substituted Filing" value={isEditing ? draft.isSubstitutedFiling : employee.substitutedFiling === "Yes"} editable={isEditing} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isSubstitutedFiling: checked }))} />
        <Field label="Previous Employer Income" value={employee.previousEmployerIncome} editable={isEditing} inputValue={draft.previousEmployerIncome} inputMode="decimal" onInputChange={(value) => setDraft((prev) => ({ ...prev, previousEmployerIncome: value }))} />
        <Field label="Previous Employer Tax Withheld" value={employee.previousEmployerTaxWithheld} editable={isEditing} inputValue={draft.previousEmployerTaxWithheld} inputMode="decimal" onInputChange={(value) => setDraft((prev) => ({ ...prev, previousEmployerTaxWithheld: value }))} />
      </FieldGrid>

      <SectionHeader title="Policy Eligibility" number="03" icon={IconAward} />
      <FieldGrid className="md:grid-cols-4">
        <ToggleField label="Overtime Eligible" value={isEditing ? draft.isOvertimeEligible : employee.overtimeEligible === "Yes"} editable={isEditing} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isOvertimeEligible: checked }))} />
        <ToggleField label="Night Differential Eligible" value={isEditing ? draft.isNightDiffEligible : employee.nightDiffEligible === "Yes"} editable={isEditing} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isNightDiffEligible: checked }))} />
        <ToggleField label="WFH Eligible" value={isEditing ? draft.isWfhEligible : employee.wfhEligible === "Yes"} editable={isEditing} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isWfhEligible: checked }))} />
        <Field label="WFH Schedule" value={employee.wfhSchedule} editable={isEditing} inputValue={draft.wfhSchedule} onInputChange={(value) => setDraft((prev) => ({ ...prev, wfhSchedule: value }))} />
      </FieldGrid>
    </div>
  )
}

function DocumentsTab({ employee }: { employee: EmployeeProfileViewModel["employee"] }) {
  return (
    <div className="space-y-8">
      <SectionHeader title="Documents" number="01" icon={IconFileText} />
      {employee.documents.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto border border-border/60">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">File</th>
                <th className="px-3 py-2 text-left font-medium">Size</th>
                <th className="px-3 py-2 text-left font-medium">Uploaded</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {employee.documents.map((document) => (
                <tr key={document.id} className="border-t border-border/60">
                  <td className="px-3 py-3">{document.title}</td>
                  <td className="px-3 py-3 text-muted-foreground">{document.type}</td>
                  <td className="px-3 py-3 text-muted-foreground">{document.fileName}</td>
                  <td className="px-3 py-3 text-muted-foreground">{document.fileSize}</td>
                  <td className="px-3 py-3 text-muted-foreground">{document.uploadedAt}</td>
                  <td className="px-3 py-3 text-right">
                    <a href={document.fileUrl} target="_blank" rel="noreferrer" className="inline-flex">
                      <Button variant="outline" size="sm">Open</Button>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SectionHeader({
  title,
  number,
  icon: Icon,
}: {
  title: string
  number: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="mb-6 mt-4 flex items-center gap-3 border-b border-primary/20 pb-2">
      <span className="text-xs font-medium text-primary/60">#{number}</span>
      <div className="h-3 w-px bg-primary/20" />
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        <Icon className="size-3.5" /> {title}
      </h3>
    </div>
  )
}

function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-3", className)}>{children}</div>
}

function Field({
  label,
  value,
  editable = false,
  inputValue,
  onInputChange,
  inputMode,
}: {
  label: string
  value: string
  editable?: boolean
  inputValue?: string
  onInputChange?: (value: string) => void
  inputMode?: "text" | "numeric" | "decimal" | "email"
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {editable && onInputChange ? (
        <Input value={inputValue ?? ""} onChange={(event) => onInputChange(event.target.value)} inputMode={inputMode} />
      ) : (
        <p className="min-h-6 border-b border-transparent pb-1 text-sm font-medium text-foreground">{value || "-"}</p>
      )}
    </div>
  )
}

function SelectField({
  label,
  value,
  editable,
  selectedValue,
  options,
  onValueChange,
  placeholder,
}: {
  label: string
  value: string
  editable: boolean
  selectedValue: string
  options: Array<{ id: string; name: string }>
  onValueChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {editable ? (
        <Select value={selectedValue || "__none__"} onValueChange={(value) => onValueChange(value === "__none__" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="min-h-6 border-b border-transparent pb-1 text-sm font-medium text-foreground">{value || "-"}</p>
      )}
    </div>
  )
}

function DateField({
  label,
  value,
  editable,
  selectedDate,
  onDateChange,
}: {
  label: string
  value: string
  editable: boolean
  selectedDate: string
  onDateChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {editable ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {selectedDate ? formatDateLabelFromInput(selectedDate) : "Select date"}
              <IconCalendar className="size-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate ? new Date(`${selectedDate}T00:00:00+08:00`) : undefined}
              onSelect={(date) => onDateChange(toDateInputValue(date))}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      ) : (
        <p className="min-h-6 border-b border-transparent pb-1 text-sm font-medium text-foreground">{value || "-"}</p>
      )}
    </div>
  )
}

function toDateInputValue(date: Date | undefined): string {
  if (!date) return ""

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date)
}

function formatDateLabelFromInput(value: string): string {
  const date = new Date(`${value}T00:00:00+08:00`)
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date)
}

function ToggleField({
  label,
  value,
  editable,
  onCheckedChange,
}: {
  label: string
  value: boolean
  editable: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {editable ? (
        <div className="flex h-10 items-center rounded-md border border-input px-3">
          <Switch checked={value} onCheckedChange={onCheckedChange} />
        </div>
      ) : (
        <p className="min-h-6 border-b border-transparent pb-1 text-sm font-medium text-foreground">{value ? "Yes" : "No"}</p>
      )}
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function Quick({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

function RowCard({ title, subtitle, meta }: { title: string; subtitle: string; meta: string }) {
  return (
    <div className="border border-border/60 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
    </div>
  )
}

function Empty({ message = "No records found." }: { message?: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function buildInitialDraft(employee: EmployeeProfileViewModel["employee"]): EmployeeProfileDraft {
  const primaryMobile = employee.contacts.find((item) => item.isPrimary)?.value ?? ""
  const primaryEmail = employee.emails.find((item) => item.isPrimary)?.value ?? ""

  return {
    firstName: employee.firstName === "-" ? "" : employee.firstName,
    lastName: employee.lastName === "-" ? "" : employee.lastName,
    middleName: employee.middleName === "-" ? "" : employee.middleName,
    suffix: employee.suffix === "-" ? "" : employee.suffix,
    maidenName: employee.maidenName === "-" ? "" : employee.maidenName,
    nickname: employee.nickname === "-" ? "" : employee.nickname,
    birthDate: employee.birthDateValue,
    birthPlace: employee.birthPlace === "-" ? "" : employee.birthPlace,
    nationality: employee.nationality === "-" ? "" : employee.nationality,
    citizenship: employee.citizenship === "-" ? "" : employee.citizenship,
    genderId: employee.genderId,
    civilStatusId: employee.civilStatusId,
    religionId: employee.religionId,
    bloodTypeId: employee.bloodTypeId,
    heightCm: employee.heightCm === "-" ? "" : employee.heightCm,
    weightKg: employee.weightKg === "-" ? "" : employee.weightKg,
    mobileNumber: primaryMobile === "-" ? "" : primaryMobile,
    personalEmail: primaryEmail === "-" ? "" : primaryEmail,
    biometricId: employee.biometricId === "-" ? "" : employee.biometricId,
    rfidNumber: employee.rfidNumber === "-" ? "" : employee.rfidNumber,
    numberOfDependents: employee.dependentsCount === "-" ? "0" : employee.dependentsCount,
    previousEmployerIncome:
      employee.previousEmployerIncome === "-"
        ? ""
        : employee.previousEmployerIncome.replace(/[^0-9.]/g, ""),
    previousEmployerTaxWithheld:
      employee.previousEmployerTaxWithheld === "-"
        ? ""
        : employee.previousEmployerTaxWithheld.replace(/[^0-9.]/g, ""),
    employmentStatusId: employee.employmentStatusId,
    employmentTypeId: employee.employmentTypeId,
    employmentClassId: employee.employmentClassId,
    departmentId: employee.departmentId,
    divisionId: employee.divisionId,
    positionId: employee.positionId,
    rankId: employee.rankId,
    branchId: employee.branchId,
    reportingManagerId: employee.reportingManagerId,
    workScheduleId: employee.workScheduleId,
    workStart: employee.workStart,
    workEnd: employee.workEnd,
    workHours: employee.workHours,
    gracePeriod: employee.gracePeriod,
    payPeriodPatternId: employee.payPeriodPatternId,
    taxStatusId: employee.taxStatusId,
    hireDate: employee.hireDateValue,
    applicationDate: employee.applicationDateValue,
    interviewDate: employee.interviewDateValue,
    jobOfferDate: employee.jobOfferDateValue,
    probationStartDate: employee.probationStartDateValue,
    probationEndDate: employee.probationEndDateValue,
    regularizationDate: employee.regularizationDateValue,
    contractStartDate: employee.contractStartDateValue,
    contractEndDate: employee.contractEndDateValue,
    monthlyRate: employee.monthlyRate === "-" ? "" : employee.monthlyRate.replace(/[^0-9.]/g, ""),
    dailyRate: employee.dailyRate === "-" ? "" : employee.dailyRate.replace(/[^0-9.]/g, ""),
    hourlyRate: employee.hourlyRate === "-" ? "" : employee.hourlyRate.replace(/[^0-9.]/g, ""),
    monthlyDivisor: employee.monthlyDivisor === "-" ? "" : employee.monthlyDivisor,
    hoursPerDay: employee.hoursPerDay === "-" ? "" : employee.hoursPerDay,
    salaryGrade: employee.salaryGrade === "-" ? "" : employee.salaryGrade,
    salaryBand: employee.salaryBand === "-" ? "" : employee.salaryBand,
    minimumWageRegion: employee.minimumWageRegion === "-" ? "" : employee.minimumWageRegion,
    tinNumber: employee.tinNumber === "-" ? "" : employee.tinNumber,
    sssNumber: employee.sssNumber === "-" ? "" : employee.sssNumber,
    philHealthNumber: employee.philHealthNumber === "-" ? "" : employee.philHealthNumber,
    pagIbigNumber: employee.pagIbigNumber === "-" ? "" : employee.pagIbigNumber,
    umidNumber: employee.umidNumber === "-" ? "" : employee.umidNumber,
    wfhSchedule: employee.wfhSchedule === "-" ? "" : employee.wfhSchedule,
    isSubstitutedFiling: employee.substitutedFiling === "Yes",
    isOvertimeEligible: employee.overtimeEligible === "Yes",
    isNightDiffEligible: employee.nightDiffEligible === "Yes",
    isWfhEligible: employee.wfhEligible === "Yes",
  }
}
