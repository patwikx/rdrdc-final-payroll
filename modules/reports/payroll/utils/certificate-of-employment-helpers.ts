export type CertificateOfEmploymentPrintPayload = {
  companyName: string
  companyLegalName: string | null
  companyLogoUrl: string | null
  companyAddressLines: string[]
  companyContactLines: string[]
  issueLocationLabel: string
  employeeName: string
  employeeNumber: string
  positionName: string
  departmentName: string
  hireDateLabel: string
  separationDateLabel: string | null
  employmentDurationLabel: string
  certificateDateLabel: string
  issuedDateFormalLabel: string
  purpose: string
  includeCompensation: boolean
  monthlySalaryAmount: number | null
  annualSalaryAmount: number | null
  midYearBonusAmount: number | null
  thirteenthMonthBonusAmount: number | null
  totalAnnualCompensationAmount: number | null
  compensationCurrency: string
  compensationRateTypeLabel: string
  signatoryName: string
  signatorySignatureUrl: string | null
  signatoryDepartmentName: string
}

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toDatePart = (value: Date): { year: number; month: number; day: number } => {
  const year = value.getUTCFullYear()
  const month = value.getUTCMonth() + 1
  const day = value.getUTCDate()
  return { year, month, day }
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

export const formatCertificateDateLabel = (value: Date): string => dateFormatter.format(value)

const toOrdinalSuffix = (day: number): string => {
  const remainder100 = day % 100
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`
  const remainder10 = day % 10
  if (remainder10 === 1) return `${day}st`
  if (remainder10 === 2) return `${day}nd`
  if (remainder10 === 3) return `${day}rd`
  return `${day}th`
}

export const formatIssuedDateFormalLabel = (value: Date): string => {
  const day = value.getUTCDate()
  const monthYear = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value)
  return `${toOrdinalSuffix(day)} Day of ${monthYear}`
}

const formatMoneyLabel = (amount: number, currency: string): string => `${currency} ${moneyFormatter.format(amount)}`

export const buildEmploymentDurationLabel = (
  hireDate: Date,
  asOfDate: Date,
  separationDate?: Date | null
): string => {
  const start = toDatePart(hireDate)
  const endSource = separationDate ?? asOfDate
  const end = toDatePart(endSource)

  let yearDiff = end.year - start.year
  let monthDiff = end.month - start.month
  const dayDiff = end.day - start.day

  if (dayDiff < 0) {
    monthDiff -= 1
  }

  if (monthDiff < 0) {
    yearDiff -= 1
    monthDiff += 12
  }

  const years = Math.max(0, yearDiff)
  const months = Math.max(0, monthDiff)

  if (years === 0 && months === 0) {
    return "less than a month"
  }

  const yearLabel = years > 0 ? `${years} year${years === 1 ? "" : "s"}` : ""
  const monthLabel = months > 0 ? `${months} month${months === 1 ? "" : "s"}` : ""

  if (yearLabel && monthLabel) return `${yearLabel} and ${monthLabel}`
  return yearLabel || monthLabel
}

export const buildCertificateBodyParagraphs = (payload: CertificateOfEmploymentPrintPayload): string[] => {
  const paragraphs: string[] = []

  const employmentEndLabel = payload.separationDateLabel ? `until ${payload.separationDateLabel}` : "up to present"

  paragraphs.push(
    `This is to certify that ${payload.employeeName} is an employee of ` +
      `${payload.companyName} a member of RD Group of Companies holding the position of ${payload.positionName} under the ${payload.departmentName} ` +
      `department since ${payload.hireDateLabel} ${employmentEndLabel}.`
  )

  paragraphs.push(`Total service period on record is ${payload.employmentDurationLabel}.`)

  if (payload.includeCompensation) {
    paragraphs.push("This is to certify further that annual compensation is stated as follows:")
  }

  return paragraphs
}

export const buildCertificatePurposeParagraph = (purpose: string): string => {
  const purposeText = purpose.trim()
  if (purposeText.length > 0) {
    return `This certification is issued upon the request of abovementioned employee for ${purposeText} purpose only.`
  }

  return "This certification is issued upon the request of above-mentioned employee for whatever legal purpose it may serve."
}

export const buildCertificateOfEmploymentHtml = (payload: CertificateOfEmploymentPrintPayload): string => {
  const paragraphs = buildCertificateBodyParagraphs(payload)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("")

  const logoMarkup = payload.companyLogoUrl
    ? `<img src="${escapeHtml(payload.companyLogoUrl)}" alt="${escapeHtml(payload.companyName)} logo" class="logo" />`
    : ""

  const compensationRows =
    payload.includeCompensation &&
    payload.annualSalaryAmount !== null &&
    payload.midYearBonusAmount !== null &&
    payload.thirteenthMonthBonusAmount !== null &&
    payload.totalAnnualCompensationAmount !== null
      ? `
        <table class="comp-table">
          <tbody>
            <tr>
              <td>Gross Annual Salary</td>
              <td>:</td>
              <td>${escapeHtml(formatMoneyLabel(payload.annualSalaryAmount, payload.compensationCurrency))}</td>
            </tr>
            <tr>
              <td>Mid-year</td>
              <td>:</td>
              <td>${escapeHtml(formatMoneyLabel(payload.midYearBonusAmount, payload.compensationCurrency))}</td>
            </tr>
            <tr>
              <td>13<sup>th</sup> Month Pay</td>
              <td>:</td>
              <td>${escapeHtml(formatMoneyLabel(payload.thirteenthMonthBonusAmount, payload.compensationCurrency))}</td>
            </tr>
            <tr class="total-row">
              <td>Total</td>
              <td>:</td>
              <td>${escapeHtml(formatMoneyLabel(payload.totalAnnualCompensationAmount, payload.compensationCurrency))}</td>
            </tr>
          </tbody>
        </table>
      `
      : ""

  const purposeText = buildCertificatePurposeParagraph(payload.purpose)
  const signatorySignatureMarkup = payload.signatorySignatureUrl
    ? `<img src="${escapeHtml(payload.signatorySignatureUrl)}" alt="${escapeHtml(payload.signatoryName)} signature" class="sig-image" />`
    : ""

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Certificate of Employment</title>
    <style>
      :root { color-scheme: light; }
      @page { size: A4 portrait; margin: 18mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #fff;
        color: #111;
        font-family: "Times New Roman", Times, serif;
        font-size: 14px;
        line-height: 1.35;
      }
      .doc {
        padding: 12px 22px;
      }
      .letterhead {
        display: flex;
        justify-content: flex-end;
        width: 100%;
        margin: 0 0 22px 0;
        padding-right: 4px;
      }
      .head {
        width: 255px;
        margin-left: auto;
        text-align: left;
      }
      .logo-wrap {
        display: flex;
        justify-content: center;
      }
      .logo {
        width: 48px;
        height: 48px;
        object-fit: contain;
      }
      .head h1 {
        margin: 0;
        font-size: 18px;
        line-height: 1.1;
      }
      .head-sep {
        width: 100%;
        height: 0;
        margin-top: 6px;
        border-top: 1.4px solid #111;
      }
      .title {
        text-align: center;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.35px;
        margin: 8px 0 30px;
      }
      .title span {
        font-size: 24px;
        text-transform: uppercase;
      }
      .head-lines {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.25;
      }
      .head-lines div {
        margin-top: 1px;
      }
      .meta {
        margin-bottom: 10px;
        font-size: 14px;
      }
      .content p {
        margin: 0 0 16px 0;
        text-align: left;
      }
      .comp-table {
        border-collapse: collapse;
        margin: -6px 0 22px 84px;
        width: 420px;
        font-size: 14px;
      }
      .comp-table td {
        padding: 1px 6px;
      }
      .comp-table td:nth-child(1) {
        width: 260px;
      }
      .comp-table td:nth-child(2) {
        width: 20px;
        text-align: center;
      }
      .comp-table td:nth-child(3) {
        width: 140px;
        text-align: right;
      }
      .comp-table .total-row td {
        padding-top: 8px;
        font-weight: 700;
      }
      .purpose {
        margin-top: 14px;
      }
      .issued {
        margin-top: 30px;
      }
      .sign {
        margin-top: 78px;
        text-align: center;
      }
      .sig-stack {
        position: relative;
        width: 280px;
        margin: 0 auto;
        padding-top: 4px;
      }
      .sig-image {
        position: absolute;
        left: 50%;
        top: -42px;
        transform: translateX(-50%);
        max-width: 230px;
        max-height: 80px;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      .line {
        display: block;
        width: 100%;
        border-top: 1px solid #111827;
      }
      .role {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        line-height: 1.2;
      }
      .name {
        margin-top: 8px;
        font-weight: 700;
        font-size: 16px;
        line-height: 1.2;
      }
      .small {
        font-size: 12px;
      }
      .doc-break {
        border-bottom: 1px solid #111;
        margin-top: 6px;
      }
      .hidden {
        display: none;
      }
      @media print {
        .doc {
          padding: 0 8px;
        }
      }
    </style>
  </head>
  <body>
    <article class="doc">
      <div class="letterhead">
        <header class="head">
          <div class="logo-wrap">
            ${logoMarkup}
          </div>
          <div>
            <h1>${escapeHtml(payload.companyName)}</h1>
          </div>
          <div class="head-sep"></div>
          <div class="head-lines">
            ${payload.companyAddressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
            ${payload.companyContactLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
          </div>
          <div class="head-sep"></div>
        </header>
      </div>

      <div class="title"><span>CERTIFICATE OF EMPLOYMENT</span></div>
      <div class="content">
        ${paragraphs}
      </div>

      ${compensationRows}

      <p class="purpose">${escapeHtml(purposeText)}</p>

      <p class="issued">Issued this ${escapeHtml(payload.issuedDateFormalLabel)} at ${escapeHtml(payload.issueLocationLabel)}.</p>

      <section class="sign">
        <div class="sig-stack">
          <div class="line"></div>
          <div class="name">${escapeHtml(payload.signatoryName)}</div>
          <div class="role">${escapeHtml(payload.signatoryDepartmentName)}</div>
          ${signatorySignatureMarkup}
        </div>
      </section>

      <div class="small hidden">Date Issued: ${escapeHtml(payload.certificateDateLabel)}</div>
    </article>
    <script>
      window.addEventListener("load", () => {
        window.print()
      })
    </script>
  </body>
</html>
`
}
