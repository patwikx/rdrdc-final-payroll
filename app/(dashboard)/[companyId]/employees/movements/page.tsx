import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  IconArrowLeft,
  IconChecklist,
  IconClockCog,
  IconGitBranch,
  IconListDetails,
  IconSparkles,
  IconUsersGroup,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"

type EmployeeMovementsRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()

    return {
      title: `Employee Movements | ${company.companyName} | Final Payroll System`,
      description: `Manage employee movement records for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Employee Movements | Final Payroll System",
      description: "Manage employee movement records.",
    }
  }
}

export default async function EmployeeMovementsRoutePage({ params }: EmployeeMovementsRouteProps) {
  const { companyId } = await params

  let company: Awaited<ReturnType<typeof getActiveCompanyContext>> | null = null
  let noAccess = false

  try {
    company = await getActiveCompanyContext({ companyId })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      noAccess = true
    } else {
      throw error
    }
  }

  if (noAccess || !company) {
    try {
      const fallback = await getActiveCompanyContext()
      redirect(`/${fallback.companyId}/dashboard`)
    } catch {
      return (
        <main className="flex w-full flex-col gap-2 px-4 py-6 sm:px-6">
          <h1 className="text-lg font-semibold text-foreground">No Company Access</h1>
          <p className="text-sm text-muted-foreground">
            Your account does not have an active company assignment yet. Please contact your administrator.
          </p>
        </main>
      )
    }
  }

  if (!hasModuleAccess(company.companyRole as CompanyRole, "employees")) {
    redirect(`/${company.companyId}/dashboard`)
  }

  /*
  const data = await getEmployeeMovementsViewModel(company.companyId)
  return <EmployeeMovementsPage data={data} designVariant={designVariant} />
  */

  return (
    <main className="w-full px-4 py-6 sm:px-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <Card className="relative border-border/70 bg-gradient-to-br from-primary/10 via-background to-muted/40 py-0">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-14 left-10 h-28 w-28 rounded-full bg-primary/10 blur-xl" />

          <CardHeader className="relative z-10 border-b border-border/50 py-5 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant="secondary" className="h-6 rounded-md px-2 text-[11px]">
                <IconClockCog className="mr-1.5 size-3.5" />
                In Development
              </Badge>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href={`/${company.companyId}/employees`}>
                  <IconArrowLeft className="mr-1.5 size-3.5" />
                  Back to Employee Masterlist
                </Link>
              </Button>
            </div>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <IconGitBranch className="size-5 text-primary sm:size-6" />
                Employee Movements Workspace
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm">
                This module is under active design iteration. We are finalizing the layout and workflow for movement
                requests, review traces, and approval controls.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="relative z-10 space-y-3 py-4 sm:py-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Design & interaction progress</span>
              <span>35%</span>
            </div>
            <Progress value={35} className="h-2" />
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IconListDetails className="size-4 text-primary" />
                Planned Experience
              </CardTitle>
              <CardDescription className="text-xs">
                Finalized sections targeted for first release.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="flex items-center justify-between border border-border/60 bg-muted/20 px-2.5 py-2">
                <span className="text-xs">Movement Intake Form</span>
                <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[10px]">Drafting</Badge>
              </div>
              <div className="flex items-center justify-between border border-border/60 bg-muted/20 px-2.5 py-2">
                <span className="text-xs">Approval Trail</span>
                <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[10px]">Queued</Badge>
              </div>
              <div className="flex items-center justify-between border border-border/60 bg-muted/20 px-2.5 py-2">
                <span className="text-xs">History Snapshot</span>
                <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[10px]">Queued</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IconChecklist className="size-4 text-primary" />
                Current Notes
              </CardTitle>
              <CardDescription className="text-xs">
                Placeholder state while the final UX direction is being approved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="border border-border/60 bg-muted/20 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-foreground">
                    <IconSparkles className="size-3.5 text-primary" />
                    Focus Area
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Keep the movement journey compact, auditable, and aligned with role-based approvals.
                  </p>
                </div>
                <div className="border border-border/60 bg-muted/20 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-foreground">
                    <IconUsersGroup className="size-3.5 text-primary" />
                    Impact
                  </p>
                  <p className="text-xs text-muted-foreground">
                    HR and payroll teams will use this area for transfer, promotion, and compensation changes.
                  </p>
                </div>
              </div>

              <Separator />

              <p className="text-xs text-muted-foreground">
                Module is intentionally paused until design decisions are finalized. Existing access checks and route
                protections remain active.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
