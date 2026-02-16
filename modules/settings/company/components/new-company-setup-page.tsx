"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconId,
  IconMapPin,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import { createCompanySetupAction } from "@/modules/settings/company/actions/create-company-setup-action"
import {
  ADDRESS_TYPE_OPTIONS,
  COMPANY_INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  CONTACT_TYPE_OPTIONS,
  EMAIL_TYPE_OPTIONS,
} from "@/modules/settings/company/schemas/company-profile-schema"
import type { CreateCompanySetupInput } from "@/modules/settings/company/schemas/create-company-setup-schema"

type ParentCompanyOption = {
  id: string
  code: string
  name: string
}

type NewCompanySetupPageProps = {
  sourceCompanyId: string
  sourceCompanyName: string
  parentCompanyOptions: ParentCompanyOption[]
}

type CompanyIndustryCode = (typeof COMPANY_INDUSTRY_OPTIONS)[number]
type CompanySizeCode = (typeof COMPANY_SIZE_OPTIONS)[number]
type AddressTypeCode = (typeof ADDRESS_TYPE_OPTIONS)[number]
type ContactTypeCode = (typeof CONTACT_TYPE_OPTIONS)[number]
type EmailTypeCode = (typeof EMAIL_TYPE_OPTIONS)[number]

const Required = () => <span className="ml-1 text-destructive">*</span>

const monthLabel = new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "Asia/Manila" })
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: monthLabel.format(new Date(Date.UTC(2020, index, 1))),
}))

const createDefaultForm = (sourceCompanyId: string): CreateCompanySetupInput => ({
  sourceCompanyId,
  company: {
    code: "",
    name: "",
    legalName: "",
    tradeName: "",
    abbreviation: "",
    companyGroupId: "",
    parentCompanyId: "",
    industryCode: undefined,
    companySizeCode: undefined,
    statusCode: "ACTIVE",
    dateOfIncorporation: "",
    tinNumber: "",
    rdoCode: "",
    secDtiNumber: "",
    sssEmployerNumber: "",
    philHealthEmployerNumber: "",
    pagIbigEmployerNumber: "",
    websiteUrl: "",
    payslipWatermarkText: "",
    fiscalYearStartMonth: 1,
    defaultCurrency: "PHP",
    minimumWageRegion: "",
  },
  primaryAddress: {
    addressTypeId: "MAIN",
    street: "",
    barangay: "",
    city: "",
    municipality: "",
    province: "",
    region: "",
    postalCode: "",
    country: "Philippines",
  },
  primaryContact: {
    contactTypeId: "MOBILE",
    countryCode: "+63",
    areaCode: "",
    number: "",
    extension: "",
  },
  primaryEmail: {
    emailTypeId: "WORK",
    email: "",
  },
  defaults: {
    initializeDefaults: true,
    grantCreatorAccess: true,
    switchToNewCompany: true,
  },
})

const formatPhDateLabel = (value: string): string => {
  const parsed = parsePhDateInputToPhDate(value)

  if (!parsed) {
    return "Select date"
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const setupSteps = [
  {
    id: "company",
    label: "Company Identity",
    description: "Legal, fiscal, and statutory profile.",
    icon: IconId,
  },
  {
    id: "contact",
    label: "Contact and Address",
    description: "Primary address and communication channels.",
    icon: IconMapPin,
  },
  {
    id: "defaults",
    label: "Finalize Setup",
    description: "Initialize defaults and launch workspace.",
    icon: IconSettings,
  },
] as const

export function NewCompanySetupPage({
  sourceCompanyId,
  sourceCompanyName,
  parentCompanyOptions,
}: NewCompanySetupPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState<CreateCompanySetupInput>(() => createDefaultForm(sourceCompanyId))

  const backHref = `/${sourceCompanyId}/settings/company`
  const activeStep = setupSteps[stepIndex]
  const ActiveStepIcon = activeStep.icon

  const parentOptions = useMemo(() => {
    return parentCompanyOptions.filter((item) => item.id !== sourceCompanyId)
  }, [parentCompanyOptions, sourceCompanyId])

  const updateCompanyField = <K extends keyof CreateCompanySetupInput["company"]>(
    key: K,
    value: CreateCompanySetupInput["company"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      company: {
        ...previous.company,
        [key]: value,
      },
    }))
  }

  const updateAddressField = <K extends keyof CreateCompanySetupInput["primaryAddress"]>(
    key: K,
    value: CreateCompanySetupInput["primaryAddress"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      primaryAddress: {
        ...previous.primaryAddress,
        [key]: value,
      },
    }))
  }

  const updateContactField = <K extends keyof CreateCompanySetupInput["primaryContact"]>(
    key: K,
    value: CreateCompanySetupInput["primaryContact"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      primaryContact: {
        ...previous.primaryContact,
        [key]: value,
      },
    }))
  }

  const updateEmailField = <K extends keyof CreateCompanySetupInput["primaryEmail"]>(
    key: K,
    value: CreateCompanySetupInput["primaryEmail"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      primaryEmail: {
        ...previous.primaryEmail,
        [key]: value,
      },
    }))
  }

  const updateDefaultsField = <K extends keyof CreateCompanySetupInput["defaults"]>(
    key: K,
    value: CreateCompanySetupInput["defaults"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      defaults: {
        ...previous.defaults,
        [key]: value,
      },
    }))
  }

  const validateStep = (targetStepIndex: number): string | null => {
    if (targetStepIndex === 0) {
      if (!form.company.code.trim()) {
        return "Company code is required."
      }

      if (!form.company.name.trim()) {
        return "Company name is required."
      }

      if (!form.company.defaultCurrency.trim() || form.company.defaultCurrency.trim().length !== 3) {
        return "Default currency must be a 3-letter code (e.g. PHP)."
      }

      return null
    }

    if (targetStepIndex === 1) {
      if (!form.primaryAddress.country.trim()) {
        return "Primary country is required."
      }

      if (!form.primaryContact.number.trim()) {
        return "Primary contact number is required."
      }

      if (!form.primaryEmail.email.trim()) {
        return "Primary email is required."
      }
    }

    return null
  }

  const moveStep = (direction: "next" | "back") => {
    if (direction === "back") {
      setStepIndex((previous) => Math.max(previous - 1, 0))
      return
    }

    const issue = validateStep(stepIndex)
    if (issue) {
      toast.error(issue)
      return
    }

    setStepIndex((previous) => Math.min(previous + 1, setupSteps.length - 1))
  }

  const handleReset = () => {
    setForm(createDefaultForm(sourceCompanyId))
    setStepIndex(0)
    toast.info("Company setup form reset.")
  }

  const handleSubmit = () => {
    const issue = validateStep(stepIndex)

    if (issue) {
      toast.error(issue)
      return
    }

    startTransition(async () => {
      const payload: CreateCompanySetupInput = {
        ...form,
        defaults: {
          ...form.defaults,
          grantCreatorAccess: true,
        },
      }

      const result = await createCompanySetupAction(payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)

      if (payload.defaults.switchToNewCompany) {
        router.push(`/${result.companyId}/dashboard`)
      } else {
        router.push(backHref)
      }

      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">System Settings</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconBuilding className="size-6 text-primary" /> New Company Setup
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {sourceCompanyName}
              </Badge>
              <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                Step {stepIndex + 1} of {setupSteps.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Wizard-based company creation with setup defaults. Company admin access for your account is automatically included.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 px-2">
              <Link href={backHref}>
                <IconArrowLeft className="size-4" />
                Back to Company Profile
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleReset} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4 px-4 py-4 sm:px-6">
        <div className="grid gap-2 md:grid-cols-3">
          {setupSteps.map((step, index) => {
            const isActive = index === stepIndex
            const isComplete = index < stepIndex
            const StepIcon = step.icon

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (index > stepIndex) return
                  setStepIndex(index)
                }}
                className={cn(
                  "border px-3 py-2 text-left transition-colors",
                  isActive && "border-primary bg-primary/5 text-foreground",
                  !isActive && !isComplete && "border-border/70 text-muted-foreground",
                  isComplete && "border-emerald-700/40 bg-emerald-600/10 text-emerald-700",
                  index > stepIndex && "cursor-not-allowed opacity-80"
                )}
              >
                <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <StepIcon className="size-4" />
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs">{step.description}</p>
              </button>
            )
          })}
        </div>

        <section className="border border-border/60 bg-background">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <ActiveStepIcon className="size-4" />
              {activeStep.label}
            </p>
            <p className="text-xs text-muted-foreground">Required fields are marked with *</p>
          </div>

          <div className="space-y-4 px-4 py-4">
            {stepIndex === 0 ? (
              <>
                <section className="border border-border/60">
                  <div className="border-b border-border/60 px-3 py-2">
                    <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <IconId className="size-3.5" /> Company Identity
                    </p>
                  </div>
                  <div className="grid gap-3 px-3 py-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="Company Code" required>
                      <Input
                        value={form.company.code}
                        placeholder="RDRDC"
                        className="w-[95px]"
                        onChange={(event) =>
                          updateCompanyField("code", event.target.value.toUpperCase().replace(/\s+/g, "_"))
                        }
                      />
                    </Field>
                    <Field label="Company Name" required className="sm:col-span-1 xl:col-span-2">
                      <Input
                        value={form.company.name}
                        placeholder="RD Realty Development Corporation"
                        onChange={(event) => updateCompanyField("name", event.target.value)}
                      />
                    </Field>
                    <Field label="Legal Name">
                      <Input value={form.company.legalName ?? ""} onChange={(event) => updateCompanyField("legalName", event.target.value)} />
                    </Field>
                    <Field label="Trade Name">
                      <Input value={form.company.tradeName ?? ""} onChange={(event) => updateCompanyField("tradeName", event.target.value)} />
                    </Field>
                    <Field label="Abbreviation">
                      <Input
                        value={form.company.abbreviation ?? ""}
                        onChange={(event) => updateCompanyField("abbreviation", event.target.value)}
                      />
                    </Field>
                    <Field label="Parent Company">
                      <Select
                        value={form.company.parentCompanyId || "NONE"}
                        onValueChange={(value) => updateCompanyField("parentCompanyId", value === "NONE" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          {parentOptions.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.code} - {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Date of Incorporation">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                            <IconCalendarEvent className="mr-2 size-4" />
                            {formatPhDateLabel(form.company.dateOfIncorporation ?? "")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parsePhDateInputToPhDate(form.company.dateOfIncorporation ?? "") ?? undefined}
                            onSelect={(date) => updateCompanyField("dateOfIncorporation", toPhDateInputValue(date))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </Field>
                    <Field label="Website URL">
                      <Input value={form.company.websiteUrl ?? ""} onChange={(event) => updateCompanyField("websiteUrl", event.target.value)} />
                    </Field>
                    <Field label="Payslip Watermark Text">
                      <Input
                        value={form.company.payslipWatermarkText ?? ""}
                        placeholder="e.g. Confidential"
                        onChange={(event) => updateCompanyField("payslipWatermarkText", event.target.value)}
                      />
                    </Field>
                  </div>
                </section>

                <section className="border border-border/60">
                  <div className="border-b border-border/60 px-3 py-2">
                    <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <IconSettings className="size-3.5" /> Fiscal and Compliance
                    </p>
                  </div>
                  <div className="grid gap-3 px-3 py-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="Industry">
                      <Select
                        value={form.company.industryCode ?? "NONE"}
                        onValueChange={(value) =>
                          updateCompanyField("industryCode", value === "NONE" ? undefined : (value as CompanyIndustryCode))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Not set</SelectItem>
                          {COMPANY_INDUSTRY_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Company Size">
                      <Select
                        value={form.company.companySizeCode ?? "NONE"}
                        onValueChange={(value) =>
                          updateCompanyField("companySizeCode", value === "NONE" ? undefined : (value as CompanySizeCode))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Not set</SelectItem>
                          {COMPANY_SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Fiscal Start Month" required>
                      <Select
                        value={String(form.company.fiscalYearStartMonth)}
                        onValueChange={(value) => updateCompanyField("fiscalYearStartMonth", Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((month) => (
                            <SelectItem key={month.value} value={String(month.value)}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Default Currency" required>
                      <Input
                        maxLength={3}
                        value={form.company.defaultCurrency}
                        onChange={(event) => updateCompanyField("defaultCurrency", event.target.value.toUpperCase())}
                      />
                    </Field>
                    <Field label="Minimum Wage Region">
                      <Input
                        value={form.company.minimumWageRegion ?? ""}
                        onChange={(event) => updateCompanyField("minimumWageRegion", event.target.value)}
                      />
                    </Field>
                    <Field label="TIN Number">
                      <Input value={form.company.tinNumber ?? ""} onChange={(event) => updateCompanyField("tinNumber", event.target.value)} />
                    </Field>
                    <Field label="RDO Code">
                      <Input value={form.company.rdoCode ?? ""} onChange={(event) => updateCompanyField("rdoCode", event.target.value)} />
                    </Field>
                    <Field label="SEC/DTI Number">
                      <Input
                        value={form.company.secDtiNumber ?? ""}
                        onChange={(event) => updateCompanyField("secDtiNumber", event.target.value)}
                      />
                    </Field>
                    <Field label="SSS Employer Number">
                      <Input
                        value={form.company.sssEmployerNumber ?? ""}
                        onChange={(event) => updateCompanyField("sssEmployerNumber", event.target.value)}
                      />
                    </Field>
                    <Field label="PhilHealth Employer Number">
                      <Input
                        value={form.company.philHealthEmployerNumber ?? ""}
                        onChange={(event) => updateCompanyField("philHealthEmployerNumber", event.target.value)}
                      />
                    </Field>
                    <Field label="Pag-IBIG Employer Number">
                      <Input
                        value={form.company.pagIbigEmployerNumber ?? ""}
                        onChange={(event) => updateCompanyField("pagIbigEmployerNumber", event.target.value)}
                      />
                    </Field>
                  </div>
                </section>
              </>
            ) : null}

            {stepIndex === 1 ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <section className="border border-border/60">
                  <div className="border-b border-border/60 px-3 py-2">
                    <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <IconMapPin className="size-3.5" /> Address Directory
                    </p>
                  </div>
                  <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
                    <Field label="Address Type" required>
                      <Select
                        value={form.primaryAddress.addressTypeId}
                        onValueChange={(value) => updateAddressField("addressTypeId", value as AddressTypeCode)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADDRESS_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Country" required>
                      <Input value={form.primaryAddress.country} onChange={(event) => updateAddressField("country", event.target.value)} />
                    </Field>
                    <Field label="Street" className="sm:col-span-2">
                      <Input value={form.primaryAddress.street ?? ""} onChange={(event) => updateAddressField("street", event.target.value)} />
                    </Field>
                    <Field label="Barangay">
                      <Input value={form.primaryAddress.barangay ?? ""} onChange={(event) => updateAddressField("barangay", event.target.value)} />
                    </Field>
                    <Field label="City">
                      <Input value={form.primaryAddress.city ?? ""} onChange={(event) => updateAddressField("city", event.target.value)} />
                    </Field>
                    <Field label="Municipality">
                      <Input
                        value={form.primaryAddress.municipality ?? ""}
                        onChange={(event) => updateAddressField("municipality", event.target.value)}
                      />
                    </Field>
                    <Field label="Province">
                      <Input value={form.primaryAddress.province ?? ""} onChange={(event) => updateAddressField("province", event.target.value)} />
                    </Field>
                    <Field label="Region">
                      <Input value={form.primaryAddress.region ?? ""} onChange={(event) => updateAddressField("region", event.target.value)} />
                    </Field>
                    <Field label="Postal Code">
                      <Input value={form.primaryAddress.postalCode ?? ""} onChange={(event) => updateAddressField("postalCode", event.target.value)} />
                    </Field>
                  </div>
                </section>

                <section className="border border-border/60">
                  <div className="border-b border-border/60 px-3 py-2">
                    <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <IconSettings className="size-3.5" /> Contact Directory
                    </p>
                  </div>
                  <div className="space-y-3 px-3 py-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Contact Type" required>
                        <Select
                          value={form.primaryContact.contactTypeId}
                          onValueChange={(value) => updateContactField("contactTypeId", value as ContactTypeCode)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTACT_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Contact Number" required>
                        <Input value={form.primaryContact.number} onChange={(event) => updateContactField("number", event.target.value)} />
                      </Field>
                      <Field label="Country Code">
                        <Input
                          value={form.primaryContact.countryCode ?? ""}
                          onChange={(event) => updateContactField("countryCode", event.target.value)}
                        />
                      </Field>
                      <Field label="Area Code">
                        <Input value={form.primaryContact.areaCode ?? ""} onChange={(event) => updateContactField("areaCode", event.target.value)} />
                      </Field>
                      <Field label="Extension">
                        <Input
                          value={form.primaryContact.extension ?? ""}
                          onChange={(event) => updateContactField("extension", event.target.value)}
                        />
                      </Field>
                    </div>

                    <Separator />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Email Type" required>
                        <Select
                          value={form.primaryEmail.emailTypeId}
                          onValueChange={(value) => updateEmailField("emailTypeId", value as EmailTypeCode)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMAIL_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Primary Email" required>
                        <Input
                          type="email"
                          placeholder="company@example.com"
                          value={form.primaryEmail.email}
                          onChange={(event) => updateEmailField("email", event.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {stepIndex === 2 ? (
              <div className="space-y-3">
                <section className="border border-border/60 px-4 py-3">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <IconCheck className="size-4 text-emerald-600" />
                    Initialize default setup records
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Creates baseline employment setup, work schedule, leave types, pay pattern, earning types, and deduction types.
                  </p>
                  <div className="mt-3 flex items-center justify-end">
                    <Switch
                      checked={form.defaults.initializeDefaults}
                      onCheckedChange={(checked) => updateDefaultsField("initializeDefaults", checked)}
                    />
                  </div>
                </section>

                <section className="border border-border/60 px-4 py-3">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <IconBuilding className="size-4 text-primary" />
                    Switch to new company after creation
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your account will automatically receive company admin access for the new company.
                  </p>
                  <div className="mt-3 flex items-center justify-end">
                    <Switch
                      checked={form.defaults.switchToNewCompany}
                      onCheckedChange={(checked) => updateDefaultsField("switchToNewCompany", checked)}
                    />
                  </div>
                </section>

                <section className="border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Company:</span> {form.company.name || "Not set"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Code:</span> {form.company.code || "Not set"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Country:</span> {form.primaryAddress.country || "Not set"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Email:</span> {form.primaryEmail.email || "Not set"}
                    </p>
                  </div>
                </section>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                className="h-8 px-2"
                onClick={() => moveStep("back")}
                disabled={stepIndex === 0 || isPending}
              >
                <IconChevronLeft className="size-4" />
                Back
              </Button>

              <div className="flex items-center gap-2">
                {stepIndex < setupSteps.length - 1 ? (
                  <Button type="button" className="h-8 px-2" onClick={() => moveStep("next")} disabled={isPending}>
                    Continue
                    <IconChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button type="button" className="h-8 px-2" onClick={handleSubmit} disabled={isPending}>
                    {isPending ? "Creating..." : "Create Company"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <Required /> : null}
      </Label>
      {children}
    </div>
  )
}

