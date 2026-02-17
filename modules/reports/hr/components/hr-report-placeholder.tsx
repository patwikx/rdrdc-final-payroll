import Link from "next/link"
import { IconArrowLeft, IconClockHour4, IconFileAnalytics } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type HrReportPlaceholderProps = {
  companyId: string
  companyName: string
  title: string
  description: string
  nextPlannedItems: string[]
}

export function HrReportPlaceholder({
  companyId,
  companyName,
  title,
  description,
  nextPlannedItems,
}: HrReportPlaceholderProps) {
  return (
    <main className="min-h-screen w-full bg-background">
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20">
        <div className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

        <section className="relative w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Reports</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  <IconFileAnalytics className="size-6 text-primary sm:size-7" />
                  {title}
                </h1>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {companyName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" type="button" size="sm" className="h-8 border-border/70">
                <Link href={`/${companyId}/reports/payroll`}>
                  <IconArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to Payroll Reports
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </header>

      <section className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <IconClockHour4 className="h-4 w-4 text-primary" />
              Implementation Queue
            </CardTitle>
            <CardDescription className="text-xs">
              This dedicated page is ready. Data model, filters, and print/export output are the next implementation step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {nextPlannedItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
