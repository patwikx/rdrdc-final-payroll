"use client"

import { useMemo, useState } from "react"
import { IconDotsVertical, IconDownload, IconEye, IconFileText, IconReceipt2, IconWallet } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type PayslipLineItem = {
  id: string
  name: string
  description: string | null
  amount: number
}

type PayslipRow = {
  id: string
  payslipNumber: string
  generatedAt: string
  releasedAt: string | null
  periodNumber: number
  cutoffStartDate: string
  cutoffEndDate: string
  basicPay: number
  grossPay: number
  totalDeductions: number
  netPay: number
  ytdGrossPay: number
  ytdTaxWithheld: number
  ytdNetPay: number
  sssEmployee: number
  philHealthEmployee: number
  pagIbigEmployee: number
  withholdingTax: number
  daysWorked: number
  daysAbsent: number
  overtimeHours: number
  tardinessMins: number
  earnings: PayslipLineItem[]
  deductions: PayslipLineItem[]
}

type PayslipsClientProps = {
  companyId: string
  payslips: PayslipRow[]
}

const amount = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const money = (value: number): string => `PHP ${amount.format(value)}`

const formatDate = (value: string): string => {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  })
}

const pageSize = 10

export function PayslipsClient({ companyId, payslips }: PayslipsClientProps) {
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRow | null>(null)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(payslips.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return payslips.slice(start, start + pageSize)
  }, [payslips, safePage])

  const latest = payslips[0]

  const handleDownload = (payslipId: string) => {
    const href = `/${companyId}/employee-portal/payslips/${payslipId}/download`
    window.open(href, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">Employee Self-Service</p>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">My Payslips</h1>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Financial Records</div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <IconWallet className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Year To Date Summary</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "YTD GROSS PAY", value: latest?.ytdGrossPay ?? 0, icon: IconWallet },
              { label: "YTD TAX WITHHELD", value: latest?.ytdTaxWithheld ?? 0, icon: IconReceipt2 },
              { label: "YTD NET PAY", value: latest?.ytdNetPay ?? 0, icon: IconWallet },
            ].map((stat) => (
              <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/20">
                <div className="mb-2 flex items-start justify-between">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xl font-semibold text-foreground">{money(stat.value)}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 border-t border-border/60 pt-3">
            <IconFileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Payslip History</h2>
          </div>

          {paged.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 py-14 text-center">
              <p className="text-sm font-semibold text-foreground">No Records</p>
              <p className="text-sm text-muted-foreground">No payslips available yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="h-9 text-xs text-muted-foreground">Period</TableHead>
                    <TableHead className="h-9 text-xs text-muted-foreground">Payslip #</TableHead>
                    <TableHead className="h-9 text-right text-xs text-muted-foreground">Gross</TableHead>
                    <TableHead className="h-9 text-right text-xs text-muted-foreground">Deductions</TableHead>
                    <TableHead className="h-9 text-right text-xs text-muted-foreground">Net Pay</TableHead>
                    <TableHead className="h-9 text-xs text-muted-foreground">Status</TableHead>
                    <TableHead className="h-9 text-right text-xs text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((payslip) => (
                    <TableRow key={payslip.id} className="group border-border/60 hover:bg-muted/30">
                      <TableCell className="py-3 text-sm">
                        {formatDate(payslip.cutoffStartDate)} <span className="mx-1 text-muted-foreground">-</span> {formatDate(payslip.cutoffEndDate)}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{payslip.payslipNumber}</TableCell>
                      <TableCell className="py-3 text-right text-sm">{money(payslip.grossPay)}</TableCell>
                      <TableCell className="py-3 text-right text-sm text-destructive">-{money(payslip.totalDeductions)}</TableCell>
                      <TableCell className="py-3 text-right text-sm font-semibold text-primary">{money(payslip.netPay)}</TableCell>
                      <TableCell className="py-3">
                        {payslip.releasedAt ? (
                          <Badge variant="default" className="rounded-full border border-emerald-600/20 bg-emerald-600/10 text-xs text-emerald-600 shadow-none hover:bg-emerald-600/20">Released</Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-full text-xs shadow-none">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0" aria-label="Open payslip actions">
                              <IconDotsVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => setSelectedPayslip(payslip)}>
                              <IconEye className="mr-2 h-3.5 w-3.5" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(payslip.id)}>
                              <IconDownload className="mr-2 h-3.5 w-3.5" />
                              Download PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {payslips.length > pageSize ? (
                <div className="flex items-center justify-between border-t border-border/60 px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Page {safePage} of {totalPages} - {payslips.length} Records
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 rounded-lg border-border/60 text-xs" disabled={safePage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg border-border/60 text-xs" disabled={safePage >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Next</Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(selectedPayslip)} onOpenChange={(open) => (!open ? setSelectedPayslip(null) : null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl border-border/60 p-0 shadow-none">
          <DialogHeader className="border-b border-border/60 bg-muted/30 px-5 py-3">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <IconReceipt2 className="h-4 w-4 text-primary" />
              Payslip Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedPayslip ? `${selectedPayslip.payslipNumber} - ${formatDate(selectedPayslip.cutoffStartDate)} to ${formatDate(selectedPayslip.cutoffEndDate)}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedPayslip ? (
            <div className="space-y-5 p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Mini label="Worked" value={`${selectedPayslip.daysWorked} days`} />
                <Mini label="Absent" value={`${selectedPayslip.daysAbsent} days`} />
                <Mini label="Overtime" value={`${selectedPayslip.overtimeHours} hrs`} />
                <Mini label="Tardiness" value={`${selectedPayslip.tardinessMins} mins`} />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 border-b border-border/60 pb-2 text-sm font-semibold text-foreground">Earnings</h3>
                  <div className="space-y-0 text-sm">
                    <Row label="Basic Pay" value={money(selectedPayslip.basicPay)} />
                    {selectedPayslip.earnings.map((earning) => (
                      <Row key={earning.id} label={earning.name} value={money(earning.amount)} description={earning.description} />
                    ))}
                    <TotalRow label="Total Gross" value={money(selectedPayslip.grossPay)} tone="good" />
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 border-b border-border/60 pb-2 text-sm font-semibold text-foreground">Deductions</h3>
                  <div className="space-y-0 text-sm">
                    <Row label="SSS" value={money(selectedPayslip.sssEmployee)} />
                    <Row label="PhilHealth" value={money(selectedPayslip.philHealthEmployee)} />
                    <Row label="Pag-IBIG" value={money(selectedPayslip.pagIbigEmployee)} />
                    <Row label="Tax" value={money(selectedPayslip.withholdingTax)} />
                    {selectedPayslip.deductions.map((deduction) => (
                      <Row key={deduction.id} label={deduction.name} value={money(deduction.amount)} description={deduction.description} />
                    ))}
                    <TotalRow label="Total Deductions" value={`-${money(selectedPayslip.totalDeductions)}`} tone="bad" />
                  </div>
                </div>
              </div>

              <Card className="rounded-xl border-primary/30 bg-primary/10">
                <CardContent className="flex items-center justify-between p-4">
                  <p className="text-sm font-semibold text-primary">Total Net Pay</p>
                  <p className="text-xl font-bold text-primary">{money(selectedPayslip.netPay)}</p>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-xl border-border/60">
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, description }: { label: string; value: string; description?: string | null }) {
  return (
    <div className="flex justify-between border-b border-dashed border-border/60 py-1.5">
      <div className="flex flex-col">
        <span className="text-sm text-foreground">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function TotalRow({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" }) {
  return (
    <div className={cn("-mx-2 mt-2 flex justify-between border-t border-border/60 px-2 py-2 font-semibold", tone === "good" ? "bg-emerald-500/5" : "bg-destructive/5")}>
      <span className="text-sm text-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}
