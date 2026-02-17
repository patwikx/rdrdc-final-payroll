"use client"

import Image, { type ImageLoaderProps } from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconFileText,
  IconPrinter,
  IconRefresh,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { parsePhDateInputToPhDate, parsePhDateInputToUtcDateOnly, toPhDateInputValue } from "@/lib/ph-time"
import type { CertificateOfEmploymentViewModel } from "@/modules/reports/payroll/types/report-view-models"
import {
  buildCertificateBodyParagraphs,
  buildCertificatePurposeParagraph,
  formatIssuedDateFormalLabel,
} from "@/modules/reports/payroll/utils/certificate-of-employment-helpers"

type CertificateOfEmploymentClientProps = CertificateOfEmploymentViewModel

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const INCLUDE_COMPENSATION_SWITCH_ID = "coe-include-compensation"
const passthroughImageLoader = ({ src }: ImageLoaderProps) => src
const SIGNATORY_POSITION_LABEL = "Admin Manager"

export function CertificateOfEmploymentClient({
  companyId,
  companyName,
  companyLegalName,
  companyLogoUrl,
  companyAddressLines,
  companyContactLines,
  issueLocationLabel,
  generatedAtLabel,
  certificateDateValue,
  includeCompensation,
  purpose,
  selectedEmployeeId,
  selectedSignatoryId,
  signatoryName,
  signatorySignatureUrl,
  options,
  employee,
}: CertificateOfEmploymentClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [purposeInput, setPurposeInput] = useState(purpose)

  useEffect(() => {
    setPurposeInput(purpose)
  }, [purpose])

  const selectedDate = parsePhDateInputToPhDate(certificateDateValue) ?? undefined
  const issuedDateFormalLabel = useMemo(() => {
    const parsedDate = parsePhDateInputToUtcDateOnly(certificateDateValue)
    if (!parsedDate) return certificateDateValue
    return formatIssuedDateFormalLabel(parsedDate)
  }, [certificateDateValue])

  const printHref = useMemo(() => {
    const params = new URLSearchParams()
    if (selectedEmployeeId) params.set("employeeId", selectedEmployeeId)
    if (selectedSignatoryId) params.set("signatoryId", selectedSignatoryId)
    if (includeCompensation) params.set("includeCompensation", "true")
    if (certificateDateValue) params.set("certificateDate", certificateDateValue)
    if (purposeInput.length > 0) params.set("purpose", purposeInput.slice(0, 300))
    return `/${companyId}/reports/payroll/certificate-of-employment/print?${params.toString()}`
  }, [
    certificateDateValue,
    companyId,
    includeCompensation,
    purposeInput,
    selectedEmployeeId,
    selectedSignatoryId,
  ])

  const previewParagraphs = useMemo(() => {
    if (!employee) return []

    return buildCertificateBodyParagraphs({
      companyName,
      companyLegalName,
      companyLogoUrl,
      companyAddressLines,
      companyContactLines,
      issueLocationLabel,
      employeeName: employee.employeeName,
      employeeNumber: employee.employeeNumber,
      positionName: employee.positionName,
      departmentName: employee.departmentName,
      hireDateLabel: employee.hireDateValue,
      separationDateLabel: employee.separationDateValue,
      employmentDurationLabel: employee.employmentDurationLabel,
      certificateDateLabel: certificateDateValue,
      purpose: purposeInput,
      includeCompensation,
      monthlySalaryAmount: employee.monthlySalaryAmount,
      annualSalaryAmount: employee.annualSalaryAmount,
      midYearBonusAmount: employee.midYearBonusAmount,
      thirteenthMonthBonusAmount: employee.thirteenthMonthBonusAmount,
      totalAnnualCompensationAmount:
        employee.annualSalaryAmount !== null &&
        employee.midYearBonusAmount !== null &&
        employee.thirteenthMonthBonusAmount !== null
          ? employee.annualSalaryAmount + employee.midYearBonusAmount + employee.thirteenthMonthBonusAmount
          : null,
      compensationCurrency: employee.compensationCurrency,
      compensationRateTypeLabel: employee.compensationRateTypeLabel,
      issuedDateFormalLabel: certificateDateValue,
      signatoryName,
      signatorySignatureUrl,
      signatoryDepartmentName: SIGNATORY_POSITION_LABEL,
    })
  }, [
    certificateDateValue,
    companyAddressLines,
    companyContactLines,
    companyLegalName,
    companyLogoUrl,
    companyName,
    employee,
    includeCompensation,
    issueLocationLabel,
    purposeInput,
    signatoryName,
    signatorySignatureUrl,
  ])

  const purposeParagraph = useMemo(() => buildCertificatePurposeParagraph(purposeInput), [purposeInput])

  const compensationPreview =
    employee &&
    employee.annualSalaryAmount !== null &&
    employee.midYearBonusAmount !== null &&
    employee.thirteenthMonthBonusAmount !== null
      ? {
          annualSalaryAmount: employee.annualSalaryAmount,
          midYearBonusAmount: employee.midYearBonusAmount,
          thirteenthMonthBonusAmount: employee.thirteenthMonthBonusAmount,
          totalAnnualCompensation:
            employee.annualSalaryAmount + employee.midYearBonusAmount + employee.thirteenthMonthBonusAmount,
        }
      : null

  const updateRoute = (updates: {
    employeeId?: string
    signatoryId?: string
    includeCompensation?: boolean
    certificateDate?: string
    purpose?: string
  }) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    const nextEmployeeId = updates.employeeId ?? selectedEmployeeId
    const nextSignatoryId = updates.signatoryId ?? selectedSignatoryId
    const nextIncludeCompensation = updates.includeCompensation ?? includeCompensation
    const nextCertificateDate = updates.certificateDate ?? certificateDateValue
    const nextPurpose = (updates.purpose ?? purposeInput).slice(0, 300)

    if (nextEmployeeId) nextParams.set("employeeId", nextEmployeeId)
    else nextParams.delete("employeeId")

    if (nextSignatoryId) nextParams.set("signatoryId", nextSignatoryId)
    else nextParams.delete("signatoryId")
    nextParams.delete("signatoryDepartmentId")

    if (nextIncludeCompensation) nextParams.set("includeCompensation", "true")
    else nextParams.delete("includeCompensation")

    if (nextCertificateDate) nextParams.set("certificateDate", nextCertificateDate)
    else nextParams.delete("certificateDate")

    if (nextPurpose.length > 0) nextParams.set("purpose", nextPurpose)
    else nextParams.delete("purpose")

    startTransition(() => {
      const query = nextParams.toString()
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname)
    })
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

        <section className="relative w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Payroll Reports</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconFileText className="size-6 text-primary sm:size-7" />
                  Certificate of Employment
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  <IconBuilding className="mr-1 size-3.5" />
                  {companyName}
                </Badge>
                <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                  <IconFileText className="mr-1 size-3.5" />
                  Document Preview
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Prepare and review a print-ready COE document. Generated: {generatedAtLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" type="button" size="sm" className="h-8 border-border/70">
                <Link href={`/${companyId}/reports/payroll`}>
                  <IconArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to Payroll Reports
                </Link>
              </Button>
              {employee ? (
                <Button asChild className="h-8 bg-blue-600 text-white hover:bg-blue-700" size="sm">
                  <Link href={printHref} target="_blank" rel="noopener noreferrer">
                    <IconPrinter className="mr-1.5 h-4 w-4" />
                    Print COE
                  </Link>
                </Button>
              ) : (
                <Button className="h-8 bg-blue-600 text-white hover:bg-blue-700" size="sm" disabled>
                  <IconPrinter className="mr-1.5 h-4 w-4" />
                  Print COE
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="grid w-full gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8 2xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="h-fit border-border/70 xl:sticky xl:top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Document Inputs</CardTitle>
              <CardDescription className="text-xs">All changes update preview and print output.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Employee <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedEmployeeId || "__NONE__"}
                  onValueChange={(value) => {
                    updateRoute({
                      employeeId: value === "__NONE__" ? "" : value,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.employees.length === 0 ? <SelectItem value="__NONE__">No employees found</SelectItem> : null}
                    {options.employees.map((employeeOption) => (
                      <SelectItem key={employeeOption.id} value={employeeOption.id}>
                        {employeeOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Date Issued <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start">
                      <IconCalendar className="mr-1.5 h-4 w-4" />
                      {certificateDateValue || "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        const nextValue = toPhDateInputValue(date)
                        if (!nextValue) return
                        updateRoute({ certificateDate: nextValue })
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Authorized Signatory <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedSignatoryId || "__NONE__"}
                  onValueChange={(value) => {
                    if (value === "__NONE__") {
                      updateRoute({ signatoryId: "" })
                      return
                    }

                    updateRoute({
                      signatoryId: value,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select signatory" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.signatories.length === 0 ? (
                      <SelectItem value="__NONE__">No signatory options found</SelectItem>
                    ) : null}
                    {options.signatories.map((signatoryOption) => (
                      <SelectItem key={signatoryOption.id} value={signatoryOption.id}>
                        {signatoryOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-none border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor={INCLUDE_COMPENSATION_SWITCH_ID}
                    className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Include Compensation
                  </Label>
                  <Switch
                    id={INCLUDE_COMPENSATION_SWITCH_ID}
                    checked={includeCompensation}
                    onCheckedChange={(checked) => {
                      updateRoute({
                        includeCompensation: checked,
                      })
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Purpose</Label>
                <Textarea
                  value={purposeInput}
                  onChange={(event) => {
                    setPurposeInput(event.target.value.slice(0, 300))
                  }}
                  onBlur={() => {
                    updateRoute({ purpose: purposeInput })
                  }}
                  maxLength={300}
                  placeholder="Optional purpose (example: visa application, bank loan, embassy submission)"
                />
                {isPending ? <p className="text-xs text-muted-foreground">Saving fields...</p> : null}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  startTransition(() => {
                    router.replace(pathname)
                  })
                }}
              >
                <IconRefresh className="mr-1.5 h-4 w-4" />
                Reset Fields
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/70">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Document Preview</CardTitle>
                  <CardDescription className="text-xs">A live, print-style certificate workspace.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-sm px-2">
                    {certificateDateValue}
                  </Badge>
                  <Badge variant="outline" className="rounded-sm px-2">
                    {includeCompensation ? "With Compensation" : "No Compensation"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="bg-muted/20 p-3 sm:p-6 xl:p-8">
              {!employee ? (
                <div className="flex min-h-[560px] items-center justify-center border border-dashed border-border/70 bg-background/80 p-6 text-center">
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Select an employee to generate a proper document preview for the certificate.
                  </p>
                </div>
              ) : (
                <article className="mx-auto w-full max-w-[1100px] border border-border/70 bg-white text-neutral-900 shadow-sm">
                  <div
                    className="px-6 py-8 text-[14px] leading-6 sm:px-10 sm:py-10 lg:px-16 lg:py-14"
                    style={{ fontFamily: '"Times New Roman", Times, serif' }}
                  >
                    <div className="flex justify-end">
                      <header className="w-full max-w-[360px] text-left">
                        {companyLogoUrl ? (
                          <div className="flex justify-center">
                            <Image
                              loader={passthroughImageLoader}
                              unoptimized
                              src={companyLogoUrl}
                              alt={`${companyName} logo`}
                              width={52}
                              height={52}
                              className="h-[52px] w-[52px] object-contain"
                            />
                          </div>
                        ) : null}
                        <div className="mt-1">
                          <p className="text-[16px] font-bold leading-tight">{companyName}</p>
                        </div>
                        <div className="mt-2 border-b border-neutral-800" />
                        <div className="mt-2 space-y-0.5 text-[12px] leading-tight">
                          {companyAddressLines.map((line, lineIndex) => (
                            <p key={`company-address-${lineIndex}`}>{line}</p>
                          ))}
                          {companyContactLines.map((line, lineIndex) => (
                            <p key={`company-contact-${lineIndex}`}>{line}</p>
                          ))}
                        </div>
                        <div className="mt-2 border-b border-neutral-800" />
                      </header>
                    </div>

                    <h2 className="mt-8 text-center text-2xl font-semibold uppercase tracking-wide">
                      Certificate of Employment
                    </h2>

                    <section className="mt-10 space-y-5 text-[15px] leading-7">
                      {previewParagraphs.map((paragraph, index) => (
                        <p key={`paragraph-${index}`}>{paragraph}</p>
                      ))}
                    </section>

                    {includeCompensation ? (
                      compensationPreview ? (
                        <div className="mt-5 w-full max-w-[540px] overflow-x-auto pl-10 sm:pl-14">
                          <table className="w-full border-collapse text-[14px] leading-6">
                            <tbody>
                              <tr>
                                <td className="pr-3">Gross Annual Salary</td>
                                <td className="w-5 text-center">:</td>
                                <td className="text-right">{moneyFormatter.format(compensationPreview.annualSalaryAmount)}</td>
                              </tr>
                              <tr>
                                <td className="pr-3">Mid-year</td>
                                <td className="w-5 text-center">:</td>
                                <td className="text-right">{moneyFormatter.format(compensationPreview.midYearBonusAmount)}</td>
                              </tr>
                              <tr>
                                <td className="pr-3">13<sup>th</sup> Month Pay</td>
                                <td className="w-5 text-center">:</td>
                                <td className="text-right">{moneyFormatter.format(compensationPreview.thirteenthMonthBonusAmount)}</td>
                              </tr>
                              <tr className="font-bold">
                                <td className="pr-3 pt-2">Total</td>
                                <td className="w-5 pt-2 text-center">:</td>
                                <td className="border-t border-neutral-800 pt-2 text-right">
                                  {moneyFormatter.format(compensationPreview.totalAnnualCompensation)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="mt-6 text-sm">No active compensation record available for this employee.</p>
                      )
                    ) : null}

                    <p className="mt-10 text-[15px] leading-7">{purposeParagraph}</p>

                    <p className="mt-8 text-[15px]">Issued this {issuedDateFormalLabel} at {issueLocationLabel}.</p>

                    <footer className="mt-20 text-center">
                      <div className="relative mx-auto w-[280px] pt-2">
                        <div className="h-px w-full bg-neutral-800" />
                        <p className="mt-2 text-[16px] font-semibold leading-tight">{signatoryName}</p>
                        <p className="text-[12px] uppercase tracking-[0.08em] leading-tight">{SIGNATORY_POSITION_LABEL}</p>
                        {signatorySignatureUrl ? (
                          <Image
                            loader={passthroughImageLoader}
                            unoptimized
                            src={signatorySignatureUrl}
                            alt={`${signatoryName} signature`}
                            width={230}
                            height={80}
                            className="pointer-events-none absolute left-1/2 top-[-42px] h-[80px] w-auto -translate-x-1/2 object-contain"
                          />
                        ) : null}
                      </div>
                    </footer>
                  </div>
                </article>
              )}
            </CardContent>
          </Card>
      </section>
    </main>
  )
}
