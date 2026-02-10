"use client"

import { useState, useTransition } from "react"
import {
  IconBriefcase,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateCompanyProfileAction } from "@/modules/settings/company/actions/update-company-profile-action"
import {
  ADDRESS_TYPE_OPTIONS,
  COMPANY_INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  COMPANY_STATUS_OPTIONS,
  CONTACT_TYPE_OPTIONS,
  EMAIL_TYPE_OPTIONS,
  type CompanyProfileInput,
} from "@/modules/settings/company/schemas/company-profile-schema"

type ParentCompanyOption = {
  id: string
  code: string
  name: string
}

type CompanyProfilePageProps = {
  companyName: string
  parentCompanyOptions: ParentCompanyOption[]
  initialData: CompanyProfileInput
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)

const formatDisplayDate = (value: string): string => {
  if (!value) {
    return ""
  }

  const parsed = new Date(`${value}T00:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const toPhDateInputValue = (date: Date | undefined): string => {
  if (!date) {
    return ""
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })

  return formatter.format(date)
}

export function CompanyProfilePage({
  companyName,
  parentCompanyOptions,
  initialData,
}: CompanyProfilePageProps) {
  const [form, setForm] = useState<CompanyProfileInput>(initialData)
  const [isPending, startTransition] = useTransition()

  const updateCompanyField = <K extends keyof CompanyProfileInput["company"]>(
    key: K,
    value: CompanyProfileInput["company"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      company: {
        ...previous.company,
        [key]: value,
      },
    }))
  }

  const updateAddressField = <K extends keyof CompanyProfileInput["primaryAddress"]>(
    key: K,
    value: CompanyProfileInput["primaryAddress"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      primaryAddress: {
        ...previous.primaryAddress,
        [key]: value,
      },
    }))
  }

  const updateContactField = <K extends keyof CompanyProfileInput["primaryContact"]>(
    key: K,
    value: CompanyProfileInput["primaryContact"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      primaryContact: {
        ...previous.primaryContact,
        [key]: value,
      },
    }))
  }

  const updateEmailField = <K extends keyof CompanyProfileInput["primaryEmail"]>(
    key: K,
    value: CompanyProfileInput["primaryEmail"][K]
  ) => {
    setForm((previous) => ({
      ...previous,
      primaryEmail: {
        ...previous.primaryEmail,
        [key]: value,
      },
    }))
  }

  const handleReset = () => {
    setForm(initialData)
    toast.info("Company profile form reset.")
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await updateCompanyProfileAction(form)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"><IconBuilding className="size-5" /> {companyName} Company Profile</h1>
            <p className="text-sm text-muted-foreground">Complete legal, tax, contact, and operational company profile.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleReset} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              <IconCheck className="size-4" />
              {isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-3 py-6">
        <ComplianceLayout
          form={form}
          parentCompanyOptions={parentCompanyOptions}
          updateCompanyField={updateCompanyField}
          updateAddressField={updateAddressField}
          updateContactField={updateContactField}
          updateEmailField={updateEmailField}
        />
      </div>
    </main>
  )
}

type LayoutProps = {
  form: CompanyProfileInput
  parentCompanyOptions: ParentCompanyOption[]
  updateCompanyField: <K extends keyof CompanyProfileInput["company"]>(
    key: K,
    value: CompanyProfileInput["company"][K]
  ) => void
  updateAddressField: <K extends keyof CompanyProfileInput["primaryAddress"]>(
    key: K,
    value: CompanyProfileInput["primaryAddress"][K]
  ) => void
  updateContactField: <K extends keyof CompanyProfileInput["primaryContact"]>(
    key: K,
    value: CompanyProfileInput["primaryContact"][K]
  ) => void
  updateEmailField: <K extends keyof CompanyProfileInput["primaryEmail"]>(
    key: K,
    value: CompanyProfileInput["primaryEmail"][K]
  ) => void
}

function ComplianceLayout(props: LayoutProps) {
  return (
    <div className="space-y-3">
      <section className="border-y border-border/60 px-4 py-4 sm:px-6">
        <div className="mb-3">
          <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground"><IconId className="size-4" /> Registration and Government IDs</h2>
          <p className="text-sm text-muted-foreground">Maintain legal, tax, and statutory identifiers.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RegistrationGovernmentFields {...props} />
        </div>
      </section>
      <section className="border-y border-border/60 px-4 py-4 sm:px-6">
        <div className="mb-3">
          <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground"><IconBriefcase className="size-4" /> Business Configuration</h2>
          <p className="text-sm text-muted-foreground">Classification, fiscal settings, and active status.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ClassificationFiscalFields {...props} />
        </div>
      </section>
      <div className="grid gap-3 px-4 sm:px-6 lg:grid-cols-2">
        <IdentityCard {...props} />
        <ContactAndAddressCard {...props} />
      </div>
    </div>
  )
}

function IdentityCard(props: LayoutProps) {
  return (
    <section className="border border-border/60 p-4">
      <div className="mb-3">
        <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground"><IconBuilding className="size-4" /> Company Identity</h2>
        <p className="text-sm text-muted-foreground">Brand, legal naming, and hierarchy profile.</p>
      </div>
      <div className="space-y-4">
        <IdentityFields {...props} />
      </div>
    </section>
  )
}

function ContactAndAddressCard(props: LayoutProps) {
  return (
    <section className="border border-border/60 p-4">
      <div className="mb-3">
        <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground"><IconMapPin className="size-4" /> Contact Directory</h2>
        <p className="text-sm text-muted-foreground">Primary address, phone, and email records.</p>
      </div>
      <div className="space-y-4">
        <AddressFields {...props} />
        <Separator />
        <ContactFields {...props} />
        <Separator />
        <EmailFields {...props} />
      </div>
    </section>
  )
}

function IdentityFields({ form, parentCompanyOptions, updateCompanyField }: LayoutProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Company Code" required>
        <Input value={form.company.code} onChange={(event) => updateCompanyField("code", event.target.value)} />
      </Field>
      <Field label="Company Name" required>
        <Input value={form.company.name} onChange={(event) => updateCompanyField("name", event.target.value)} />
      </Field>
      <Field label="Legal Name">
        <Input value={form.company.legalName ?? ""} onChange={(event) => updateCompanyField("legalName", event.target.value)} />
      </Field>
      <Field label="Trade Name">
        <Input value={form.company.tradeName ?? ""} onChange={(event) => updateCompanyField("tradeName", event.target.value)} />
      </Field>
      <Field label="Abbreviation">
        <Input value={form.company.abbreviation ?? ""} onChange={(event) => updateCompanyField("abbreviation", event.target.value)} />
      </Field>
      <Field label="Parent Company">
        <Select
          value={form.company.parentCompanyId ?? "none"}
          onValueChange={(value) => updateCompanyField("parentCompanyId", value === "none" ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="No parent company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No parent company</SelectItem>
            {parentCompanyOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.code} - {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Logo URL">
        <Input value={form.company.logoUrl ?? ""} onChange={(event) => updateCompanyField("logoUrl", event.target.value)} />
      </Field>
      <Field label="Website URL">
        <Input value={form.company.websiteUrl ?? ""} onChange={(event) => updateCompanyField("websiteUrl", event.target.value)} />
      </Field>
      <Field label="Payslip Watermark Text">
        <Input
          value={form.company.payslipWatermarkText ?? ""}
          onChange={(event) => updateCompanyField("payslipWatermarkText", event.target.value)}
          placeholder="e.g. Confidential"
        />
      </Field>
    </div>
  )
}

function RegistrationGovernmentFields({ form, updateCompanyField }: LayoutProps) {
  return (
    <>
      <Field label="SEC/DTI Number">
        <Input value={form.company.secDtiNumber ?? ""} onChange={(event) => updateCompanyField("secDtiNumber", event.target.value)} />
      </Field>
      <Field label="Date of Incorporation">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              <span>
                {form.company.dateOfIncorporation
                  ? formatDisplayDate(form.company.dateOfIncorporation)
                  : "Select date"}
              </span>
              <IconCalendarEvent className="size-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <Calendar
              mode="single"
              selected={
                form.company.dateOfIncorporation
                  ? new Date(`${form.company.dateOfIncorporation}T00:00:00+08:00`)
                  : undefined
              }
              onSelect={(date) => updateCompanyField("dateOfIncorporation", toPhDateInputValue(date))}
              captionLayout="dropdown"
              fromYear={1900}
              toYear={new Date().getFullYear()}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field label="TIN Number">
        <Input value={form.company.tinNumber ?? ""} onChange={(event) => updateCompanyField("tinNumber", event.target.value)} />
      </Field>
      <Field label="RDO Code">
        <Input value={form.company.rdoCode ?? ""} onChange={(event) => updateCompanyField("rdoCode", event.target.value)} />
      </Field>
      <Field label="SSS Employer Number">
        <Input value={form.company.sssEmployerNumber ?? ""} onChange={(event) => updateCompanyField("sssEmployerNumber", event.target.value)} />
      </Field>
      <Field label="SSS Branch Code">
        <Input value={form.company.sssBranchCode ?? ""} onChange={(event) => updateCompanyField("sssBranchCode", event.target.value)} />
      </Field>
      <Field label="PhilHealth Employer Number">
        <Input value={form.company.philHealthEmployerNumber ?? ""} onChange={(event) => updateCompanyField("philHealthEmployerNumber", event.target.value)} />
      </Field>
      <Field label="Pag-IBIG Employer Number">
        <Input value={form.company.pagIbigEmployerNumber ?? ""} onChange={(event) => updateCompanyField("pagIbigEmployerNumber", event.target.value)} />
      </Field>
    </>
  )
}

function ClassificationFiscalFields({ form, updateCompanyField }: LayoutProps) {
  return (
    <>
      <Field label="Industry">
        <Select
          value={form.company.industryCode ?? "none"}
          onValueChange={(value) =>
            updateCompanyField(
              "industryCode",
              value === "none" ? undefined : (value as (typeof COMPANY_INDUSTRY_OPTIONS)[number])
            )
          }
        >
          <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {COMPANY_INDUSTRY_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Company Size">
        <Select
          value={form.company.companySizeCode ?? "none"}
          onValueChange={(value) =>
            updateCompanyField(
              "companySizeCode",
              value === "none" ? undefined : (value as (typeof COMPANY_SIZE_OPTIONS)[number])
            )
          }
        >
          <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {COMPANY_SIZE_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Status">
        <Select
          value={form.company.statusCode ?? "none"}
          onValueChange={(value) =>
            updateCompanyField(
              "statusCode",
              value === "none" ? undefined : (value as (typeof COMPANY_STATUS_OPTIONS)[number])
            )
          }
        >
          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {COMPANY_STATUS_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Fiscal Year Start Month" required>
        <Select value={String(form.company.fiscalYearStartMonth)} onValueChange={(value) => updateCompanyField("fiscalYearStartMonth", Number(value))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map((value) => (
              <SelectItem key={value} value={String(value)}>Month {value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Default Currency" required>
        <Input value={form.company.defaultCurrency} onChange={(event) => updateCompanyField("defaultCurrency", event.target.value.toUpperCase())} />
      </Field>
      <Field label="Minimum Wage Region">
        <Input value={form.company.minimumWageRegion ?? ""} onChange={(event) => updateCompanyField("minimumWageRegion", event.target.value)} />
      </Field>
      <div className="flex items-center justify-between rounded-md border border-border/70 bg-background p-2">
        <p className="text-xs font-medium text-foreground">Company Active</p>
        <Switch checked={form.company.isActive} onCheckedChange={(checked) => updateCompanyField("isActive", checked)} />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs text-muted-foreground">Notes</Label>
        <Textarea value={`Status: ${form.company.statusCode ?? "Not set"}`} readOnly className="mt-1 h-16 text-xs" />
      </div>
    </>
  )
}

function AddressFields({ form, updateAddressField }: LayoutProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><IconMapPin className="size-3.5" /> Address</p>
      </div>
      <Field label="Address Type" required>
        <Select
          value={form.primaryAddress.addressTypeId}
          onValueChange={(value) => updateAddressField("addressTypeId", value as (typeof ADDRESS_TYPE_OPTIONS)[number])}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ADDRESS_TYPE_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Country" required>
        <Input value={form.primaryAddress.country} onChange={(event) => updateAddressField("country", event.target.value)} />
      </Field>
      <Field label="Street"><Input value={form.primaryAddress.street ?? ""} onChange={(event) => updateAddressField("street", event.target.value)} /></Field>
      <Field label="Barangay"><Input value={form.primaryAddress.barangay ?? ""} onChange={(event) => updateAddressField("barangay", event.target.value)} /></Field>
      <Field label="City"><Input value={form.primaryAddress.city ?? ""} onChange={(event) => updateAddressField("city", event.target.value)} /></Field>
      <Field label="Municipality"><Input value={form.primaryAddress.municipality ?? ""} onChange={(event) => updateAddressField("municipality", event.target.value)} /></Field>
      <Field label="Province"><Input value={form.primaryAddress.province ?? ""} onChange={(event) => updateAddressField("province", event.target.value)} /></Field>
      <Field label="Region"><Input value={form.primaryAddress.region ?? ""} onChange={(event) => updateAddressField("region", event.target.value)} /></Field>
      <Field label="Postal Code"><Input value={form.primaryAddress.postalCode ?? ""} onChange={(event) => updateAddressField("postalCode", event.target.value)} /></Field>
    </div>
  )
}

function ContactFields({ form, updateContactField }: LayoutProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><IconBriefcase className="size-3.5" /> Contact Number</p>
      </div>
      <Field label="Contact Type" required>
        <Select
          value={form.primaryContact.contactTypeId}
          onValueChange={(value) => updateContactField("contactTypeId", value as (typeof CONTACT_TYPE_OPTIONS)[number])}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONTACT_TYPE_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Contact Number" required>
        <Input value={form.primaryContact.number ?? ""} onChange={(event) => updateContactField("number", event.target.value)} />
      </Field>
      <Field label="Country Code"><Input value={form.primaryContact.countryCode ?? ""} onChange={(event) => updateContactField("countryCode", event.target.value)} /></Field>
      <Field label="Area Code"><Input value={form.primaryContact.areaCode ?? ""} onChange={(event) => updateContactField("areaCode", event.target.value)} /></Field>
      <Field label="Extension"><Input value={form.primaryContact.extension ?? ""} onChange={(event) => updateContactField("extension", event.target.value)} /></Field>
    </div>
  )
}

function EmailFields({ form, updateEmailField }: LayoutProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><IconMail className="size-3.5" /> Email</p>
      </div>
      <Field label="Email Type" required>
        <Select
          value={form.primaryEmail.emailTypeId}
          onValueChange={(value) => updateEmailField("emailTypeId", value as (typeof EMAIL_TYPE_OPTIONS)[number])}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EMAIL_TYPE_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Primary Email" required>
        <Input type="email" value={form.primaryEmail.email ?? ""} onChange={(event) => updateEmailField("email", event.target.value)} />
      </Field>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required ? <Required /> : null}
      </Label>
      {children}
    </div>
  )
}
