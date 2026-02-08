import { chromium, type Browser } from "playwright"

type PayslipPdfLineItem = {
  name: string
  amount: number
}

export type PayslipPdfData = {
  payslipNumber: string
  generatedAt: Date
  releasedAt: Date | null
  periodNumber: number
  cutoffStartDate: Date
  cutoffEndDate: Date
  employeeName: string
  employeeNumber: string
  companyName: string
  companyLegalName: string | null
  companyLogoUrl: string | null
  watermarkText: string | null
  baseSalary: number
  basicPay: number
  grossPay: number
  totalDeductions: number
  netPay: number
  sssEmployee: number
  philHealthEmployee: number
  pagIbigEmployee: number
  withholdingTax: number
  daysWorked: number
  daysAbsent: number
  overtimeHours: number
  tardinessMins: number
  earnings: PayslipPdfLineItem[]
  deductions: PayslipPdfLineItem[]
}

const dateLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")

const toMoneyPlain = (value: number): string =>
  value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const renderLineItems = (items: PayslipPdfLineItem[], targetRows: number): string => {
  const rows = items
    .map(
      (item) => `
      <tr class="line-item">
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(toMoneyPlain(item.amount))}</td>
      </tr>`
    )
    .join("")

  const blanks = Math.max(targetRows - items.length, 0)
  const blankRows = Array.from({ length: blanks })
    .map(
      () => `
      <tr class="line-item blank-row">
        <td>&nbsp;</td>
        <td>&nbsp;</td>
      </tr>`
    )
    .join("")

  return `${rows}${blankRows}`
}

const buildPayslipHtml = (data: PayslipPdfData): string => {
  const companySubtitle = data.companyLegalName && data.companyLegalName !== data.companyName ? data.companyLegalName : null
  const watermark = data.watermarkText?.trim() || null
  const monthLabel = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(data.cutoffEndDate)
  const primaryColor = "#111827"

  const displayedBasicPay = data.baseSalary > 0 ? data.baseSalary / 2 : data.basicPay

  const earnings = [
    { name: "Basic Pay", amount: displayedBasicPay },
    ...data.earnings.filter(
      (line) => line.amount > 0 && !/basic\s*pay/i.test(line.name)
    ),
  ]

  const statutoryDeductions = [
    { name: "SSS", amount: data.sssEmployee },
    { name: "PhilHealth", amount: data.philHealthEmployee },
    { name: "Pag-IBIG", amount: data.pagIbigEmployee },
    { name: "Withholding Tax", amount: data.withholdingTax },
  ].filter((line) => line.amount > 0)

  const tardinessAmount = data.deductions
    .filter((line) => line.amount > 0 && (/late/i.test(line.name) || /tardiness/i.test(line.name)))
    .reduce((sum, line) => sum + line.amount, 0)

  const attendanceDeductions = tardinessAmount > 0 ? [{ name: "Tardiness", amount: tardinessAmount }] : []

  const displayedDeductions = [...statutoryDeductions, ...attendanceDeductions]
  const displayedDeductionsTotal = displayedDeductions.reduce((sum, line) => sum + line.amount, 0)
  const lineCount = Math.max(earnings.length, displayedDeductions.length, 1)

  const logoMarkup = data.companyLogoUrl
    ? `<img src="${escapeHtml(data.companyLogoUrl)}" alt="${escapeHtml(data.companyName)} logo" class="logo" />`
    : ""

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(data.payslipNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
        color: #111;
        background: #ffffff;
        font-size: 12px;
      }
      .card {
        border: 1px solid #d1d5db;
        padding: 24px;
        position: relative;
        z-index: 1;
        background: #fff;
      }
      .header {
        border-bottom: 2px solid ${primaryColor};
        padding-bottom: 14px;
        margin-bottom: 14px;
      }
      .header-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .header-copy h1 {
        margin: 0;
        font-size: 22px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      .company-info {
        margin-top: 2px;
        font-size: 10px;
        color: #6b7280;
        line-height: 1.4;
      }
      .logo {
        max-height: 48px;
        max-width: 48px;
        object-fit: contain;
      }
      .payslip-label {
        font-size: 11px;
        text-transform: uppercase;
        color: #6b7280;
        letter-spacing: 0.06em;
        font-weight: 700;
      }
      .period-label {
        font-size: 14px;
        margin-top: 2px;
      }
      .meta-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin-bottom: 16px;
      }
      .employee-block {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .employee-name {
        font-size: 15px;
        text-transform: uppercase;
      }
      .tiny {
        font-size: 10px;
        text-transform: uppercase;
      }
      .muted {
        color: #666;
      }
      .section-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .section-col {
        display: flex;
        flex-direction: column;
      }
      .table-wrap {
        flex: 1;
      }
      .section-title {
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 6px;
        margin-bottom: 8px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      .line-item td {
        padding: 3px 0;
        font-size: 11px;
      }
      .deductions-table .line-item td {
        font-size: 10px;
      }
      .line-item td:first-child {
        text-transform: uppercase;
        color: #666;
        font-weight: 700;
      }
      .line-item td:last-child {
        text-align: right;
        font-weight: 500;
      }
      .blank-row td {
        color: transparent;
      }
      .line-foot {
        margin-top: 8px;
        border-top: 1px solid #d1d5db;
        padding-top: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .net-section {
        margin-top: 12px;
        border-top: 2px solid ${primaryColor};
        padding-top: 10px;
      }
      .net-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .net-row span:first-child {
        font-size: 14px;
        text-transform: uppercase;
      }
      .net-row span:last-child {
        font-size: 30px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .footer-note {
        margin-top: 14px;
        border-top: 1px solid #d1d5db;
        padding-top: 8px;
        text-align: center;
        font-size: 10px;
        text-transform: uppercase;
        color: #666;
      }
      .watermark {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 52px;
        letter-spacing: 0.16em;
        color: rgba(0, 0, 0, 0.04);
        transform: rotate(-24deg);
        z-index: 0;
        pointer-events: none;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    ${watermark ? `<div class="watermark">${escapeHtml(watermark)}</div>` : ""}
    <div class="card">
      <div class="header">
        <div class="header-top">
          <div style="display:flex; align-items:center; gap:12px;">
            ${logoMarkup}
            <div class="header-copy">
              <h1>${escapeHtml(data.companyName)}</h1>
              ${companySubtitle ? `<div class="company-info">${escapeHtml(companySubtitle)}</div>` : ""}
            </div>
          </div>
          <div style="text-align:right;">
            <div class="payslip-label">Payslip</div>
            <div class="period-label">${escapeHtml(monthLabel)}</div>
          </div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="employee-block">
          <div>
            <div class="employee-name">${escapeHtml(data.employeeName)}</div>
            <div class="tiny muted">${escapeHtml(data.employeeNumber)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="tiny muted">Pay Period</div>
          <div>${escapeHtml(dateLabel.format(data.cutoffStartDate))} - ${escapeHtml(dateLabel.format(data.cutoffEndDate))}</div>
          <div class="tiny muted" style="margin-top:4px;">Payslip No. ${escapeHtml(data.payslipNumber)}</div>
        </div>
      </div>

      <div class="section-grid">
        <div class="section-col">
          <div class="section-title">Earnings</div>
          <div class="table-wrap">
            <table>
              <tbody>
                ${renderLineItems(earnings, lineCount)}
              </tbody>
            </table>
          </div>
          <div class="line-foot"><span>Gross Pay</span><span>${escapeHtml(toMoneyPlain(data.grossPay))}</span></div>
        </div>
        <div class="section-col">
          <div class="section-title">Deductions</div>
          <div class="table-wrap">
            <table class="deductions-table">
              <tbody>
                ${renderLineItems(displayedDeductions, lineCount)}
              </tbody>
            </table>
          </div>
          <div class="line-foot"><span>Total Deductions</span><span>${escapeHtml(toMoneyPlain(displayedDeductionsTotal))}</span></div>
        </div>
      </div>

      <div class="net-section">
        <div class="net-row">
          <span>Net Pay</span>
          <span>${escapeHtml(toMoneyPlain(data.netPay))}</span>
        </div>
      </div>

      <div class="footer-note">
        This is a computer-generated payslip.
      </div>
    </div>
  </body>
</html>`
}

let browserPromise: Promise<Browser> | null = null

const getBrowser = async (): Promise<Browser> => {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
  }

  return browserPromise
}

export async function generatePayslipPdfBuffer(data: PayslipPdfData): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setContent(buildPayslipHtml(data), {
      waitUntil: "networkidle",
    })

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "14mm",
        right: "10mm",
        bottom: "14mm",
        left: "10mm",
      },
    })

    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}
