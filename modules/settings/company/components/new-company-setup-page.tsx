"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconId,
  IconMail,
  IconMapPin,
  IconRefresh,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)

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
  { id: "company", label: "Company Details", icon: IconId },
  { id: "contact", label: "Contact and Address", icon: IconMapPin },
  { id: "defaults", label: "Defaults and Access", icon: IconCalendarEvent },
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
      const result = await createCompanySetupAction(form)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)

      if (form.defaults.switchToNewCompany) {
        router.push(`/${result.companyId}/dashboard`)
      } else {
        router.push(backHref)
      }

      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <IconBuilding className="size-5" />
              New Company Setup
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create another company workspace from {sourceCompanyName} with optional default settings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={backHref}>
                <IconArrowLeft className="size-4" />
                Back to Company Profile
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <section className="space-y-4 px-4 py-6 sm:px-6">
        <div className="grid gap-2 md:grid-cols-3">
          {setupSteps.map((step, index) => {
            const isActive = index === stepIndex
            const isComplete = index < stepIndex
            const StepIcon = step.icon

            return (
              <div
                key={step.id}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm transition-colors",
                  isActive && "border-primary bg-primary/5 text-primary",
                  !isActive && !isComplete && "border-border/70 text-muted-foreground",
                  isComplete && "border-emerald-700/50 bg-emerald-600/10 text-emerald-700"
                )}
              >
                <p className="inline-flex items-center gap-2 font-medium">
                  <StepIcon className="size-4" />
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <ActiveStepIcon className="size-4" />
              {activeStep.label}
            </CardTitle>
            <CardDescription>
              {stepIndex === 0
                ? "Define registration details, fiscal defaults, and statutory identifiers."
                : stepIndex === 1
                  ? "Set primary contact, email, and address information."
                  : "Choose whether to initialize default policies and switch company context."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {stepIndex === 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="companyCode">
                    Company Code<Required />
                  </Label>
                  <Input
                    id="companyCode"
                    value={form.company.code}
                    placeholder="RDRDC"
                    onChange={(event) =>
                      updateCompanyField(
                        "code",
                        event.target.value.toUpperCase().replace(/\s+/g, "_")
                      )
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="companyName">
                    Company Name<Required />
                  </Label>
                  <Input
                    id="companyName"
                    value={form.company.name}
                    placeholder="RD Realty Development Corporation"
                    onChange={(event) => updateCompanyField("name", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyLegalName">Legal Name</Label>
                  <Input
                    id="companyLegalName"
                    value={form.company.legalName ?? ""}
                    onChange={(event) => updateCompanyField("legalName", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyTradeName">Trade Name</Label>
                  <Input
                    id="companyTradeName"
                    value={form.company.tradeName ?? ""}
                    onChange={(event) => updateCompanyField("tradeName", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAbbreviation">Abbreviation</Label>
                  <Input
                    id="companyAbbreviation"
                    value={form.company.abbreviation ?? ""}
                    onChange={(event) => updateCompanyField("abbreviation", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industryCode">Industry</Label>
                  <Select
                    value={form.company.industryCode ?? "NONE"}
                    onValueChange={(value) =>
                      updateCompanyField(
                        "industryCode",
                        value === "NONE" ? undefined : (value as CompanyIndustryCode)
                      )
                    }
                  >
                    <SelectTrigger id="industryCode">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companySize">Company Size</Label>
                  <Select
                    value={form.company.companySizeCode ?? "NONE"}
                    onValueChange={(value) =>
                      updateCompanyField(
                        "companySizeCode",
                        value === "NONE" ? undefined : (value as CompanySizeCode)
                      )
                    }
                  >
                    <SelectTrigger id="companySize">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentCompanyId">Parent Company</Label>
                  <Select
                    value={form.company.parentCompanyId || "NONE"}
                    onValueChange={(value) => updateCompanyField("parentCompanyId", value === "NONE" ? "" : value)}
                  >
                    <SelectTrigger id="parentCompanyId">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateIncorporation">Date of Incorporation</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="dateIncorporation"
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <IconCalendarEvent className="mr-2 size-4" />
                        {formatPhDateLabel(form.company.dateOfIncorporation ?? "")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={parsePhDateInputToPhDate(form.company.dateOfIncorporation ?? "") ?? undefined}
                        onSelect={(date) => {
                          updateCompanyField("dateOfIncorporation", toPhDateInputValue(date))
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fiscalMonth">
                    Fiscal Start Month<Required />
                  </Label>
                  <Select
                    value={String(form.company.fiscalYearStartMonth)}
                    onValueChange={(value) => updateCompanyField("fiscalYearStartMonth", Number(value))}
                  >
                    <SelectTrigger id="fiscalMonth">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month} value={String(month)}>
                          Month {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currencyCode">
                    Default Currency<Required />
                  </Label>
                  <Input
                    id="currencyCode"
                    maxLength={3}
                    value={form.company.defaultCurrency}
                    onChange={(event) => updateCompanyField("defaultCurrency", event.target.value.toUpperCase())}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tinNumber">TIN Number</Label>
                  <Input
                    id="tinNumber"
                    value={form.company.tinNumber ?? ""}
                    onChange={(event) => updateCompanyField("tinNumber", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rdoCode">RDO Code</Label>
                  <Input
                    id="rdoCode"
                    value={form.company.rdoCode ?? ""}
                    onChange={(event) => updateCompanyField("rdoCode", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secDtiNumber">SEC/DTI Number</Label>
                  <Input
                    id="secDtiNumber"
                    value={form.company.secDtiNumber ?? ""}
                    onChange={(event) => updateCompanyField("secDtiNumber", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sssEmployerNumber">SSS Employer Number</Label>
                  <Input
                    id="sssEmployerNumber"
                    value={form.company.sssEmployerNumber ?? ""}
                    onChange={(event) => updateCompanyField("sssEmployerNumber", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="philHealthEmployerNumber">PhilHealth Employer Number</Label>
                  <Input
                    id="philHealthEmployerNumber"
                    value={form.company.philHealthEmployerNumber ?? ""}
                    onChange={(event) => updateCompanyField("philHealthEmployerNumber", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pagIbigEmployerNumber">Pag-IBIG Employer Number</Label>
                  <Input
                    id="pagIbigEmployerNumber"
                    value={form.company.pagIbigEmployerNumber ?? ""}
                    onChange={(event) => updateCompanyField("pagIbigEmployerNumber", event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {stepIndex === 1 ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="addressTypeId">
                      Address Type<Required />
                    </Label>
                    <Select
                      value={form.primaryAddress.addressTypeId}
                      onValueChange={(value) => updateAddressField("addressTypeId", value as AddressTypeCode)}
                    >
                      <SelectTrigger id="addressTypeId">
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
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="street">Street</Label>
                    <Input
                      id="street"
                      value={form.primaryAddress.street ?? ""}
                      onChange={(event) => updateAddressField("street", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="barangay">Barangay</Label>
                    <Input
                      id="barangay"
                      value={form.primaryAddress.barangay ?? ""}
                      onChange={(event) => updateAddressField("barangay", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.primaryAddress.city ?? ""}
                      onChange={(event) => updateAddressField("city", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="municipality">Municipality</Label>
                    <Input
                      id="municipality"
                      value={form.primaryAddress.municipality ?? ""}
                      onChange={(event) => updateAddressField("municipality", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="province">Province</Label>
                    <Input
                      id="province"
                      value={form.primaryAddress.province ?? ""}
                      onChange={(event) => updateAddressField("province", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      value={form.primaryAddress.region ?? ""}
                      onChange={(event) => updateAddressField("region", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={form.primaryAddress.postalCode ?? ""}
                      onChange={(event) => updateAddressField("postalCode", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">
                      Country<Required />
                    </Label>
                    <Input
                      id="country"
                      value={form.primaryAddress.country}
                      onChange={(event) => updateAddressField("country", event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="contactTypeId">
                      Contact Type<Required />
                    </Label>
                    <Select
                      value={form.primaryContact.contactTypeId}
                      onValueChange={(value) => updateContactField("contactTypeId", value as ContactTypeCode)}
                    >
                      <SelectTrigger id="contactTypeId">
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="countryCode">Country Code</Label>
                    <Input
                      id="countryCode"
                      value={form.primaryContact.countryCode ?? ""}
                      onChange={(event) => updateContactField("countryCode", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="areaCode">Area Code</Label>
                    <Input
                      id="areaCode"
                      value={form.primaryContact.areaCode ?? ""}
                      onChange={(event) => updateContactField("areaCode", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">
                      Contact Number<Required />
                    </Label>
                    <Input
                      id="phoneNumber"
                      value={form.primaryContact.number}
                      onChange={(event) => updateContactField("number", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="extension">Extension</Label>
                    <Input
                      id="extension"
                      value={form.primaryContact.extension ?? ""}
                      onChange={(event) => updateContactField("extension", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emailTypeId">
                      Email Type<Required />
                    </Label>
                    <Select
                      value={form.primaryEmail.emailTypeId}
                      onValueChange={(value) => updateEmailField("emailTypeId", value as EmailTypeCode)}
                    >
                      <SelectTrigger id="emailTypeId">
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
                  </div>

                  <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <Label htmlFor="primaryEmail">
                      Primary Email<Required />
                    </Label>
                    <Input
                      id="primaryEmail"
                      type="email"
                      placeholder="company@example.com"
                      value={form.primaryEmail.email}
                      onChange={(event) => updateEmailField("email", event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {stepIndex === 2 ? (
              <div className="space-y-4">
                <div className="rounded-md border border-border/70 px-4 py-3">
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
                </div>

                <div className="rounded-md border border-border/70 px-4 py-3">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <IconMail className="size-4 text-primary" />
                    Grant current user company admin access
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Adds active `UserCompanyAccess` for this new company so you can manage it immediately.
                  </p>
                  <div className="mt-3 flex items-center justify-end">
                    <Switch
                      checked={form.defaults.grantCreatorAccess}
                      onCheckedChange={(checked) => {
                        updateDefaultsField("grantCreatorAccess", checked)
                        if (!checked) {
                          updateDefaultsField("switchToNewCompany", false)
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border/70 px-4 py-3">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <IconBuilding className="size-4 text-primary" />
                    Switch to new company after creation
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updates your selected company context right after successful creation.
                  </p>
                  <div className="mt-3 flex items-center justify-end">
                    <Switch
                      checked={form.defaults.switchToNewCompany}
                      disabled={!form.defaults.grantCreatorAccess}
                      onCheckedChange={(checked) => updateDefaultsField("switchToNewCompany", checked)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => moveStep("back")}
                disabled={stepIndex === 0 || isPending}
              >
                Back
              </Button>

              <div className="flex items-center gap-2">
                {stepIndex < setupSteps.length - 1 ? (
                  <Button type="button" onClick={() => moveStep("next")} disabled={isPending}>
                    Continue
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSubmit} disabled={isPending}>
                    {isPending ? "Creating..." : "Create Company"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
