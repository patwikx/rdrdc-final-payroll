"use client"

import type { ChangeEvent } from "react"
import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import {
  IconBriefcase,
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconId,
  IconMail,
  IconMapPin,
  IconPhoto,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import { getPhYear, parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import { cn } from "@/lib/utils"
import { createCompanyLogoUploadUrlAction } from "@/modules/settings/company/actions/create-company-logo-upload-url-action"
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
  canCreateCompany: boolean
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)

const formatDisplayDate = (value: string): string => {
  if (!value) {
    return ""
  }

  const parsed = parsePhDateInputToPhDate(value)
  if (!parsed) {
    return ""
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

export function CompanyProfilePage({
  companyName,
  parentCompanyOptions,
  initialData,
  canCreateCompany,
}: CompanyProfilePageProps) {
  const [form, setForm] = useState<CompanyProfileInput>(initialData)
  const [isPending, startTransition] = useTransition()
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

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

  const handleCompanyLogoFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Company logo must be 5 MB or below.")
      return
    }

    setIsLogoUploading(true)
    try {
      const upload = await createCompanyLogoUploadUrlAction({
        companyId: form.companyId,
        fileName: file.name,
        fileType: file.type,
      })

      if (!upload.ok) {
        toast.error(upload.error)
        return
      }

      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: upload.requiredHeaders,
        body: file,
      })

      if (!response.ok) {
        toast.error("Failed to upload company logo.")
        return
      }

      const logoUrl = new URL("/api/company-logo", window.location.origin)
      logoUrl.searchParams.set("companyId", form.companyId)
      logoUrl.searchParams.set("key", upload.objectKey)

      updateCompanyField("logoUrl", logoUrl.toString())
      toast.success("Company logo uploaded.")
    } catch {
      toast.error("Failed to upload company logo.")
    } finally {
      setIsLogoUploading(false)
    }
  }

  const clearCompanyLogo = () => {
    updateCompanyField("logoUrl", undefined)
    toast.info("Company logo cleared.")
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">System Settings</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconBuilding className="size-6 text-primary" /> Company Profile
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {companyName}
              </Badge>
              <Badge
                variant={form.company.isActive ? "default" : "secondary"}
                className={cn("h-6 px-2 text-[11px]", !form.company.isActive ? "text-muted-foreground" : "")}
              >
                {form.company.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Maintain legal registration, fiscal setup, and primary company directory data.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateCompany ? (
              <Button asChild type="button" variant="outline" size="sm" className="h-8 px-2" disabled={isPending}>
                <Link href={`/${initialData.companyId}/settings/company/new`}>
                  <IconPlus className="size-4" />
                  New Company Setup
                </Link>
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={handleReset} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset
            </Button>
            <Button type="button" size="sm" className="h-8 px-2" onClick={handleSubmit} disabled={isPending}>
              <IconCheck className="size-4" />
              {isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-3 px-4 py-4 sm:px-6">
        <ComplianceLayout
          form={form}
          parentCompanyOptions={parentCompanyOptions}
          logoInputRef={logoInputRef}
          isLogoUploading={isLogoUploading}
          onLogoFileSelected={handleCompanyLogoFile}
          onClearLogo={clearCompanyLogo}
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
  logoInputRef: React.RefObject<HTMLInputElement | null>
  isLogoUploading: boolean
  onLogoFileSelected: (file: File | undefined) => Promise<void>
  onClearLogo: () => void
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
    <div className="space-y-3 pb-4">
      <CompanyIdentityAndContactSection {...props} />

      <section className="border border-border/60 bg-background">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground">
            <IconId className="size-4" /> Registration and Government IDs
          </h2>
          <p className="text-sm text-muted-foreground">Maintain legal, tax, and statutory identifiers.</p>
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <RegistrationGovernmentFields {...props} />
        </div>
      </section>
      <section className="border border-border/60 bg-background">
        <div className="border-b border-border/60 px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground">
            <IconBriefcase className="size-4" /> Business Configuration
          </h2>
          <p className="text-sm text-muted-foreground">Classification, fiscal settings, and active status.</p>
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <ClassificationFiscalFields {...props} />
        </div>
      </section>
    </div>
  )
}

function CompanyIdentityAndContactSection(props: LayoutProps) {
  return (
    <section className="border border-border/60 bg-background">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="px-4 py-4 lg:border-r lg:border-border/60">
          <div className="mb-3">
            <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground">
              <IconBuilding className="size-4" /> Company Identity
            </h2>
            <p className="text-sm text-muted-foreground">Brand, legal naming, and hierarchy profile.</p>
          </div>
          <IdentityFields {...props} />
        </div>

        <div className="border-t border-border/60 px-4 py-4 lg:border-t-0">
          <div className="mb-3">
            <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground">
              <IconBriefcase className="size-4" /> Contact Directory
            </h2>
            <p className="text-sm text-muted-foreground">Primary contact and email records.</p>
          </div>
          <div className="space-y-4">
            <ContactFields {...props} />
            <Separator />
            <EmailFields {...props} />
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 px-4 py-4">
        <div className="mb-3">
          <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground">
            <IconMapPin className="size-4" /> Address Directory
          </h2>
          <p className="text-sm text-muted-foreground">Primary company address records.</p>
        </div>
        <AddressFields {...props} />
      </div>
    </section>
  )
}

function IdentityFields({
  form,
  parentCompanyOptions,
  logoInputRef,
  isLogoUploading,
  onLogoFileSelected,
  onClearLogo,
  updateCompanyField,
}: LayoutProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => logoInputRef.current?.click()}
          disabled={isLogoUploading}
          className="group relative flex h-56 w-full items-center justify-center overflow-hidden border border-dashed border-border/70 bg-muted/20 text-muted-foreground transition hover:border-primary/50 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {form.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.company.logoUrl} alt="Company logo preview" className="h-full w-full object-contain p-3" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <IconPhoto className="size-8" />
              <span className="text-xs">{isLogoUploading ? "Uploading..." : "Upload company logo"}</span>
            </div>
          )}
          {!form.company.logoUrl ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border/60 bg-background/90 px-3 py-2 text-center text-xs text-muted-foreground">
              Upload a JPG, PNG, WEBP, GIF, or SVG logo. Maximum size is 5 MB.
            </div>
          ) : null}
        </button>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            void onLogoFileSelected(event.target.files?.[0])
            event.currentTarget.value = ""
          }}
        />
        {form.company.logoUrl ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-full"
            disabled={isLogoUploading}
            onClick={onClearLogo}
          >
            Clear image
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Company Code
            <Required />
          </Label>
          <Input
            className="w-[75px]"
            value={form.company.code}
            onChange={(event) => updateCompanyField("code", event.target.value)}
          />
        </div>
        <div className="sm:col-span-1 xl:col-span-2">
          <Field label="Company Name" required>
            <Input value={form.company.name} onChange={(event) => updateCompanyField("name", event.target.value)} />
          </Field>
        </div>
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
            <SelectTrigger className='w-full'>
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
                      ? (parsePhDateInputToPhDate(form.company.dateOfIncorporation) ?? undefined)
                      : undefined
                  }
                  onSelect={(date) => updateCompanyField("dateOfIncorporation", toPhDateInputValue(date))}
              captionLayout="dropdown"
              fromYear={1900}
              toYear={getPhYear()}
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
      <div className="flex items-center justify-between border border-border/70 bg-background p-2">
        <p className="text-sm text-foreground">Company Active</p>
        <Switch checked={form.company.isActive} onCheckedChange={(checked) => updateCompanyField("isActive", checked)} />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs text-muted-foreground">Notes</Label>
        <Textarea value={`Status: ${form.company.statusCode ?? "Not set"}`} readOnly className="mt-1 h-16 text-sm" />
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
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONTACT_TYPE_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Contact Number">
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
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
        {required ? <Required /> : null}
      </Label>
      {children}
    </div>
  )
}
