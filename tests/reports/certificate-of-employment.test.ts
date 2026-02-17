import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCertificateBodyParagraphs,
  buildCertificateOfEmploymentHtml,
  buildEmploymentDurationLabel,
} from "../../modules/reports/payroll/utils/certificate-of-employment-helpers.ts"

test("buildEmploymentDurationLabel returns combined years and months", () => {
  const label = buildEmploymentDurationLabel(
    new Date("2020-01-01T00:00:00.000Z"),
    new Date("2026-02-16T00:00:00.000Z")
  )

  assert.equal(label, "6 years and 1 month")
})

test("buildEmploymentDurationLabel returns less than a month for short tenure", () => {
  const label = buildEmploymentDurationLabel(
    new Date("2026-02-01T00:00:00.000Z"),
    new Date("2026-02-16T00:00:00.000Z")
  )

  assert.equal(label, "less than a month")
})

test("buildCertificateBodyParagraphs includes compensation paragraph only when enabled", () => {
  const withCompensation = buildCertificateBodyParagraphs({
    companyName: "Tropicana Worldwide Corporation",
    companyLegalName: null,
    companyLogoUrl: null,
    companyAddressLines: [],
    companyContactLines: [],
    issueLocationLabel: "General Santos City, Philippines",
    employeeName: "Juan Dela Cruz",
    employeeNumber: "E-001",
    positionName: "Payroll Officer",
    departmentName: "Finance",
    hireDateLabel: "January 01, 2020",
    separationDateLabel: null,
    employmentDurationLabel: "6 years",
    certificateDateLabel: "February 16, 2026",
    issuedDateFormalLabel: "16th Day of February 2026",
    purpose: "visa application",
    includeCompensation: true,
    monthlySalaryAmount: 50000,
    annualSalaryAmount: 600000,
    midYearBonusAmount: 25000,
    thirteenthMonthBonusAmount: 50000,
    totalAnnualCompensationAmount: 675000,
    compensationCurrency: "PHP",
    compensationRateTypeLabel: "Monthly rate",
    signatoryName: "Xanthia Ruth N. Babasa",
    signatorySignatureUrl: null,
    signatoryDepartmentName: "Admin Manager",
  })

  const withoutCompensation = buildCertificateBodyParagraphs({
    companyName: "Tropicana Worldwide Corporation",
    companyLegalName: null,
    companyLogoUrl: null,
    companyAddressLines: [],
    companyContactLines: [],
    issueLocationLabel: "General Santos City, Philippines",
    employeeName: "Juan Dela Cruz",
    employeeNumber: "E-001",
    positionName: "Payroll Officer",
    departmentName: "Finance",
    hireDateLabel: "January 01, 2020",
    separationDateLabel: null,
    employmentDurationLabel: "6 years",
    certificateDateLabel: "February 16, 2026",
    issuedDateFormalLabel: "16th Day of February 2026",
    purpose: "visa application",
    includeCompensation: false,
    monthlySalaryAmount: 50000,
    annualSalaryAmount: 600000,
    midYearBonusAmount: 25000,
    thirteenthMonthBonusAmount: 50000,
    totalAnnualCompensationAmount: 675000,
    compensationCurrency: "PHP",
    compensationRateTypeLabel: "Monthly rate",
    signatoryName: "Xanthia Ruth N. Babasa",
    signatorySignatureUrl: null,
    signatoryDepartmentName: "Admin Manager",
  })

  assert.equal(withCompensation.some((line) => line.includes("annual compensation is stated as follows")), true)
  assert.equal(withoutCompensation.some((line) => line.includes("annual compensation is stated as follows")), false)
  assert.equal(withCompensation.some((line) => line.includes("Employee No.")), false)
})

test("buildCertificateOfEmploymentHtml contains certificate heading", () => {
  const html = buildCertificateOfEmploymentHtml({
    companyName: "Tropicana Worldwide Corporation",
    companyLegalName: null,
    companyLogoUrl: null,
    companyAddressLines: ["General Santos Business Park"],
    companyContactLines: ["Tel +63 8355 4435"],
    issueLocationLabel: "General Santos City, Philippines",
    employeeName: "Juan Dela Cruz",
    employeeNumber: "E-001",
    positionName: "Payroll Officer",
    departmentName: "Finance",
    hireDateLabel: "January 01, 2020",
    separationDateLabel: null,
    employmentDurationLabel: "6 years",
    certificateDateLabel: "February 16, 2026",
    issuedDateFormalLabel: "16th Day of February 2026",
    purpose: "",
    includeCompensation: false,
    monthlySalaryAmount: null,
    annualSalaryAmount: null,
    midYearBonusAmount: null,
    thirteenthMonthBonusAmount: null,
    totalAnnualCompensationAmount: null,
    compensationCurrency: "PHP",
    compensationRateTypeLabel: "Monthly rate",
    signatoryName: "Xanthia Ruth N. Babasa",
    signatorySignatureUrl: null,
    signatoryDepartmentName: "Admin Manager",
  })

  assert.equal(html.includes("Certificate of Employment"), true)
  assert.equal(html.includes("window.print"), true)
})

test("buildCertificateOfEmploymentHtml renders compensation table when enabled", () => {
  const html = buildCertificateOfEmploymentHtml({
    companyName: "Tropicana Worldwide Corporation",
    companyLegalName: null,
    companyLogoUrl: null,
    companyAddressLines: [],
    companyContactLines: [],
    issueLocationLabel: "General Santos City, Philippines",
    employeeName: "Juan Dela Cruz",
    employeeNumber: "E-001",
    positionName: "Payroll Officer",
    departmentName: "Finance",
    hireDateLabel: "January 01, 2020",
    separationDateLabel: null,
    employmentDurationLabel: "6 years",
    certificateDateLabel: "February 16, 2026",
    issuedDateFormalLabel: "16th Day of February 2026",
    purpose: "visa application",
    includeCompensation: true,
    monthlySalaryAmount: 50000,
    annualSalaryAmount: 600000,
    midYearBonusAmount: 25000,
    thirteenthMonthBonusAmount: 50000,
    totalAnnualCompensationAmount: 675000,
    compensationCurrency: "PHP",
    compensationRateTypeLabel: "Monthly rate",
    signatoryName: "Xanthia Ruth N. Babasa",
    signatorySignatureUrl: null,
    signatoryDepartmentName: "Admin Manager",
  })

  assert.equal(html.includes("Gross Annual Salary"), true)
  assert.equal(html.includes("Mid-year"), true)
  assert.equal(html.includes("13<sup>th</sup> Month Pay"), true)
  assert.equal(html.includes("Total"), true)
})
