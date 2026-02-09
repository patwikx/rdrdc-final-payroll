import styles from "@/modules/payroll/components/government-remittance-reports.module.css"

export type PhilHealthRemittanceRow = {
  idNumber: string
  employeeName: string
  pin: string
  employeeShare: number
  employerShare: number
}

export type SssRemittanceRow = {
  idNumber: string
  employeeName: string
  sssNumber: string
  employeeShare: number
  employerShare: number
}

export type PagIbigContributionRow = {
  employeeId: string
  surname: string
  firstName: string
  middleName: string
  birthDate: Date
  pagIbigNumber: string
  employeeShare: number
  employerShare: number
}

export type Dole13thMonthRow = {
  employeeId: string
  employeeName: string
  annualBasicSalary: number
  thirteenthMonthPay: number
}

export type GovernmentRemittanceReportsProps = {
  companyName: string
  philHealthMonth: Date
  pagIbigMonth: Date
  printedAt: Date
  printedBy: string
  pageLabel?: string
  philHealthRows: PhilHealthRemittanceRow[]
  sssRows?: SssRemittanceRow[]
  pagIbigRows: PagIbigContributionRow[]
  dole13thRows?: Dole13thMonthRow[]
  birAlphalistRows?: Array<{
    employeeId: string
    employeeName: string
    tinNumber: string
    sssEmployee: number
    philHealthEmployee: number
    pagIbigEmployee: number
    grossCompensation: number
    taxableCompensation: number
    withholdingTax: number
  }>
  birYear?: number
  showPhilHealth?: boolean
  showSss?: boolean
  showPagIbig?: boolean
  showDole13th?: boolean
  showBirAlphalist?: boolean
}

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const monthYearFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const printDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  timeZone: "Asia/Manila",
})

const printTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Manila",
})

const birthDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "2-digit",
  timeZone: "Asia/Manila",
})

const formatMoney = (value: number): string => moneyFormatter.format(value)

const formatPagIbigNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 12) {
    return value
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`
}

export function GovernmentRemittanceReports({
  companyName,
  philHealthMonth,
  pagIbigMonth,
  printedAt,
  printedBy,
  pageLabel = "Page 1 of 1",
  philHealthRows,
  sssRows = [],
  pagIbigRows,
  dole13thRows = [],
  birAlphalistRows = [],
  birYear = new Date().getFullYear(),
  showPhilHealth = true,
  showSss = false,
  showPagIbig = true,
  showDole13th = false,
  showBirAlphalist = false,
}: GovernmentRemittanceReportsProps) {
  const philHealthTotals = philHealthRows.reduce(
    (acc, row) => {
      acc.employeeShare += row.employeeShare
      acc.employerShare += row.employerShare
      return acc
    },
    { employeeShare: 0, employerShare: 0 }
  )

  const pagIbigTotals = pagIbigRows.reduce(
    (acc, row) => {
      acc.employeeShare += row.employeeShare
      acc.employerShare += row.employerShare
      return acc
    },
    { employeeShare: 0, employerShare: 0 }
  )

  const sssTotals = sssRows.reduce(
    (acc, row) => {
      acc.employeeShare += row.employeeShare
      acc.employerShare += row.employerShare
      return acc
    },
    { employeeShare: 0, employerShare: 0 }
  )

  const doleTotals = dole13thRows.reduce(
    (acc, row) => {
      acc.annualBasicSalary += row.annualBasicSalary
      acc.thirteenthMonthPay += row.thirteenthMonthPay
      return acc
    },
    { annualBasicSalary: 0, thirteenthMonthPay: 0 }
  )

  const birTotals = birAlphalistRows.reduce(
    (acc, row) => {
      acc.sssEmployee += row.sssEmployee
      acc.philHealthEmployee += row.philHealthEmployee
      acc.pagIbigEmployee += row.pagIbigEmployee
      acc.grossCompensation += row.grossCompensation
      acc.taxableCompensation += row.taxableCompensation
      acc.withholdingTax += row.withholdingTax
      return acc
    },
    {
      sssEmployee: 0,
      philHealthEmployee: 0,
      pagIbigEmployee: 0,
      grossCompensation: 0,
      taxableCompensation: 0,
      withholdingTax: 0,
    }
  )

  return (
    <div className={styles.printRoot}>
      {showPhilHealth ? (
      <section className={styles.reportPage} aria-label="PhilHealth Remittance Report">
        <div className={styles.reportStartSeparator} />
        <header className={styles.headerCenter}>
          <h1>{companyName.toUpperCase()}</h1>
          <h2>PHILHEALTH REMMITTANCE</h2>
          <p>FOR THE MONTH OF {monthYearFormatter.format(philHealthMonth).toUpperCase()}</p>
        </header>

        <div className={styles.tableWrap}>
          <table className={styles.reportTable}>
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "32%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className={styles.leftText}>ID #</th>
                <th className={styles.leftText}>Employee&apos;s Name</th>
                <th className={styles.leftText}>PIN</th>
                <th className={styles.rightText}>Employee Share</th>
                <th className={styles.rightText}>Employer Share</th>
                <th className={styles.rightText}>Totals</th>
              </tr>
            </thead>
            <tbody>
              {philHealthRows.map((row) => {
                const rowTotal = row.employeeShare + row.employerShare

                return (
                  <tr key={`${row.idNumber}-${row.pin}`}>
                    <td className={styles.leftText}>{row.idNumber.toUpperCase()}</td>
                    <td className={styles.leftText}>{row.employeeName.toUpperCase()}</td>
                    <td className={styles.leftText}>{row.pin.toUpperCase()}</td>
                    <td className={styles.rightText}>{formatMoney(row.employeeShare)}</td>
                    <td className={styles.rightText}>{formatMoney(row.employerShare)}</td>
                    <td className={styles.rightText}>{formatMoney(rowTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className={styles.totalsRow}>
                <td colSpan={3} className={styles.leftText}>TOTAL</td>
                <td className={styles.rightText}>{formatMoney(philHealthTotals.employeeShare)}</td>
                <td className={styles.rightText}>{formatMoney(philHealthTotals.employerShare)}</td>
                <td className={styles.rightText}>{formatMoney(philHealthTotals.employeeShare + philHealthTotals.employerShare)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={styles.printFooter}>
          <span>
            Print Date : {printDateFormatter.format(printedAt)} | Print Time : {printTimeFormatter.format(printedAt)}
          </span>
          <span>
            {pageLabel} | User : {printedBy}
          </span>
        </div>
      </section>
      ) : null}

      {showPagIbig ? (
      <section className={styles.reportPage} aria-label="Pag-IBIG Contribution Report">
        <div className={styles.reportStartSeparator} />

        <header className={styles.headerCenter}>
          <h1>{companyName.toUpperCase()}</h1>
          <h2>MONTHLY PAG-IBIG CONTRIBUTION REPORT</h2>
          <p>FOR THE MONTH OF {monthYearFormatter.format(pagIbigMonth).toUpperCase()}</p>
        </header>

        <div className={styles.tableWrap}>
          <table className={styles.reportTable}>
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead className={`${styles.capsHeader} ${styles.doubleTopHeader}`}>
              <tr>
                <th>EMPLOYEE ID</th>
                <th>SURNAME</th>
                <th>FIRST NAME</th>
                <th>MIDDLE NAME</th>
                <th>BIRTHDATE</th>
                <th>PAG-IBIG #</th>
                <th>PAG-IBIG EE</th>
                <th>PAG-IBIG ER</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {pagIbigRows.map((row) => {
                const rowTotal = row.employeeShare + row.employerShare

                return (
                  <tr key={`${row.employeeId}-${row.pagIbigNumber}`}>
                    <td className={styles.leftText}>{row.employeeId}</td>
                    <td className={styles.leftText}>{row.surname.toUpperCase()}</td>
                    <td className={styles.leftText}>{row.firstName.toUpperCase()}</td>
                    <td className={styles.leftText}>{row.middleName.toUpperCase()}</td>
                    <td className={styles.centerText}>{birthDateFormatter.format(row.birthDate)}</td>
                    <td className={styles.leftText}>{formatPagIbigNumber(row.pagIbigNumber)}</td>
                    <td className={styles.rightText}>{formatMoney(row.employeeShare)}</td>
                    <td className={styles.rightText}>{formatMoney(row.employerShare)}</td>
                    <td className={styles.rightText}>{formatMoney(rowTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className={styles.totalsRow}>
                <td colSpan={5} className={styles.leftText}>PAGE TOTAL</td>
                <td className={`${styles.leftText} ${styles.headCount}`}>HEAD COUNT ({pagIbigRows.length})</td>
                <td className={styles.rightText}>{formatMoney(pagIbigTotals.employeeShare)}</td>
                <td className={styles.rightText}>{formatMoney(pagIbigTotals.employerShare)}</td>
                <td className={styles.rightText}>{formatMoney(pagIbigTotals.employeeShare + pagIbigTotals.employerShare)}</td>
              </tr>
              <tr className={styles.totalsRow}>
                <td colSpan={6} className={styles.leftText}>GRAND TOTAL</td>
                <td className={styles.rightText}>{formatMoney(pagIbigTotals.employeeShare)}</td>
                <td className={styles.rightText}>{formatMoney(pagIbigTotals.employerShare)}</td>
                <td className={styles.rightText}>{formatMoney(pagIbigTotals.employeeShare + pagIbigTotals.employerShare)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={styles.printFooter}>
          <span>
            Print Date : {printDateFormatter.format(printedAt)} | Print Time : {printTimeFormatter.format(printedAt)}
          </span>
          <span>
            {pageLabel} | User : {printedBy}
          </span>
        </div>
      </section>
      ) : null}

      {showSss ? (
      <section className={styles.reportPage} aria-label="SSS Monthly Remittance Report">
        <div className={styles.reportStartSeparator} />
        <header className={styles.headerCenter}>
          <h1>{companyName.toUpperCase()}</h1>
          <h2>SSS MONTHLY REMITTANCE REPORT</h2>
          <p>FOR THE MONTH OF {monthYearFormatter.format(philHealthMonth).toUpperCase()}</p>
        </header>

        <div className={styles.tableWrap}>
          <table className={styles.reportTable}>
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "34%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className={styles.leftText}>ID #</th>
                <th className={styles.leftText}>EMPLOYEE NAME</th>
                <th className={styles.leftText}>SSS #</th>
                <th className={styles.rightText}>EMPLOYEE SHARE</th>
                <th className={styles.rightText}>EMPLOYER SHARE</th>
                <th className={styles.rightText}>TOTALS</th>
              </tr>
            </thead>
            <tbody>
              {sssRows.map((row) => {
                const rowTotal = row.employeeShare + row.employerShare

                return (
                  <tr key={`${row.idNumber}-${row.sssNumber}`}>
                    <td className={styles.leftText}>{row.idNumber.toUpperCase()}</td>
                    <td className={styles.leftText}>{row.employeeName.toUpperCase()}</td>
                    <td className={styles.leftText}>{row.sssNumber.toUpperCase()}</td>
                    <td className={styles.rightText}>{formatMoney(row.employeeShare)}</td>
                    <td className={styles.rightText}>{formatMoney(row.employerShare)}</td>
                    <td className={styles.rightText}>{formatMoney(rowTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className={styles.totalsRow}>
                <td colSpan={3} className={styles.leftText}>TOTAL</td>
                <td className={styles.rightText}>{formatMoney(sssTotals.employeeShare)}</td>
                <td className={styles.rightText}>{formatMoney(sssTotals.employerShare)}</td>
                <td className={styles.rightText}>{formatMoney(sssTotals.employeeShare + sssTotals.employerShare)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={styles.printFooter}>
          <span>
            Print Date : {printDateFormatter.format(printedAt)} | Print Time : {printTimeFormatter.format(printedAt)}
          </span>
          <span>
            {pageLabel} | User : {printedBy}
          </span>
        </div>
      </section>
      ) : null}

      {showBirAlphalist ? (
      <section className={styles.reportPage} aria-label="BIR Alphalist Report">
        <div className={styles.reportStartSeparator} />

        <header className={styles.headerCenter}>
          <h1>{companyName.toUpperCase()}</h1>
          <h2>BIR ANNUAL ALPHALIST</h2>
          <p>FOR TAXABLE YEAR {String(birYear).toUpperCase()}</p>
        </header>

        <div className={styles.tableWrap}>
          <table className={styles.reportTable}>
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "21%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead className={styles.capsHeader}>
              <tr>
                <th>EMPLOYEE ID</th>
                <th>EMPLOYEE NAME</th>
                <th>TIN</th>
                <th className={styles.rightText}>SSS EE</th>
                <th className={styles.rightText}>PH EE</th>
                <th className={styles.rightText}>PG EE</th>
                <th className={styles.rightText}>GROSS COMPENSATION</th>
                <th className={styles.rightText}>TAXABLE COMPENSATION</th>
                <th className={styles.rightText}>WITHHOLDING TAX</th>
              </tr>
            </thead>
            <tbody>
              {birAlphalistRows.map((row) => (
                <tr key={`${row.employeeId}-${row.tinNumber}`}>
                  <td className={styles.leftText}>{row.employeeId.toUpperCase()}</td>
                  <td className={styles.leftText}>{row.employeeName.toUpperCase()}</td>
                  <td className={styles.leftText}>{row.tinNumber.toUpperCase()}</td>
                  <td className={styles.rightText}>{formatMoney(row.sssEmployee)}</td>
                  <td className={styles.rightText}>{formatMoney(row.philHealthEmployee)}</td>
                  <td className={styles.rightText}>{formatMoney(row.pagIbigEmployee)}</td>
                  <td className={styles.rightText}>{formatMoney(row.grossCompensation)}</td>
                  <td className={styles.rightText}>{formatMoney(row.taxableCompensation)}</td>
                  <td className={styles.rightText}>{formatMoney(row.withholdingTax)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalsRow}>
                <td colSpan={3} className={styles.leftText}>TOTAL</td>
                <td className={styles.rightText}>{formatMoney(birTotals.sssEmployee)}</td>
                <td className={styles.rightText}>{formatMoney(birTotals.philHealthEmployee)}</td>
                <td className={styles.rightText}>{formatMoney(birTotals.pagIbigEmployee)}</td>
                <td className={styles.rightText}>{formatMoney(birTotals.grossCompensation)}</td>
                <td className={styles.rightText}>{formatMoney(birTotals.taxableCompensation)}</td>
                <td className={styles.rightText}>{formatMoney(birTotals.withholdingTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={styles.printFooter}>
          <span>
            Print Date : {printDateFormatter.format(printedAt)} | Print Time : {printTimeFormatter.format(printedAt)}
          </span>
          <span>
            {pageLabel} | User : {printedBy}
          </span>
        </div>
      </section>
      ) : null}

      {showDole13th ? (
      <section className={styles.reportPage} aria-label="DOLE 13th Month Pay Report">
        <div className={styles.reportStartSeparator} />

        <header className={styles.headerCenter}>
          <h1>{companyName.toUpperCase()}</h1>
          <h2>DOLE 13TH MONTH PAY REPORT</h2>
          <p>FOR CALENDAR YEAR {String(birYear).toUpperCase()}</p>
        </header>

        <div className={styles.tableWrap}>
          <table className={styles.reportTable}>
            <colgroup>
              <col style={{ width: "14%" }} />
              <col style={{ width: "38%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "24%" }} />
            </colgroup>
            <thead className={styles.capsHeader}>
              <tr>
                <th>EMPLOYEE ID</th>
                <th>EMPLOYEE NAME</th>
                <th className={styles.rightText}>ANNUAL BASIC SALARY</th>
                <th className={styles.rightText}>13TH MONTH PAY</th>
              </tr>
            </thead>
            <tbody>
              {dole13thRows.map((row) => (
                <tr key={`${row.employeeId}-${row.employeeName}`}>
                  <td className={styles.leftText}>{row.employeeId.toUpperCase()}</td>
                  <td className={styles.leftText}>{row.employeeName.toUpperCase()}</td>
                  <td className={styles.rightText}>{formatMoney(row.annualBasicSalary)}</td>
                  <td className={styles.rightText}>{formatMoney(row.thirteenthMonthPay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalsRow}>
                <td colSpan={2} className={styles.leftText}>TOTAL</td>
                <td className={styles.rightText}>{formatMoney(doleTotals.annualBasicSalary)}</td>
                <td className={styles.rightText}>{formatMoney(doleTotals.thirteenthMonthPay)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={styles.printFooter}>
          <span>
            Print Date : {printDateFormatter.format(printedAt)} | Print Time : {printTimeFormatter.format(printedAt)}
          </span>
          <span>
            {pageLabel} | User : {printedBy}
          </span>
        </div>
      </section>
      ) : null}
    </div>
  )
}
