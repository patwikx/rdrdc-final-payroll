import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  ActiveCompanyContextError,
  getActiveCompanyContext,
} from "@/modules/auth/utils/active-company-context"
import { db } from "@/lib/db"
import { LegacyMaterialRequestSyncPage } from "@/modules/settings/material-requests/components/legacy-material-request-sync-page"

type LegacyMaterialRequestSyncRouteProps = {
  params: Promise<{ companyId: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await getActiveCompanyContext()
    return {
      title: `Legacy Material Request Sync | ${company.companyName} | Final Payroll System`,
      description: `Sync legacy material requests for ${company.companyName}.`,
    }
  } catch {
    return {
      title: "Legacy Material Request Sync | Final Payroll System",
      description: "Sync legacy material requests.",
    }
  }
}

export default async function LegacyMaterialRequestSyncRoutePage({ params }: LegacyMaterialRequestSyncRouteProps) {
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

  const [departments, departmentApprovalFlowsRaw] = await Promise.all([
    db.department.findMany({
      where: {
        companyId: company.companyId,
        isActive: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
    db.departmentMaterialRequestApprovalFlow.findMany({
      where: {
        companyId: company.companyId,
        isActive: true,
      },
      select: {
        departmentId: true,
        requiredSteps: true,
        steps: {
          orderBy: [{ stepNumber: "asc" }, { approverUserId: "asc" }],
          select: {
            stepNumber: true,
            stepName: true,
            approverUserId: true,
            approverUser: {
              select: {
                firstName: true,
                lastName: true,
                isActive: true,
                isRequestApprover: true,
                companyAccess: {
                  where: {
                    companyId: company.companyId,
                    isActive: true,
                  },
                  select: {
                    id: true,
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
  ])

  const departmentApprovalFlows = departmentApprovalFlowsRaw.map((flow) => {
    const stepSummaryByStepNumber = new Map<
      number,
      {
        stepName: string
        defaultApproverUserId: string | null
        approvers: Array<{ approverUserId: string; approverName: string }>
      }
    >()

    for (let stepNumber = 1; stepNumber <= flow.requiredSteps; stepNumber += 1) {
      stepSummaryByStepNumber.set(stepNumber, {
        stepName: `Step ${stepNumber}`,
        defaultApproverUserId: null,
        approvers: [],
      })
    }

    for (const step of flow.steps) {
      if (step.stepNumber < 1 || step.stepNumber > flow.requiredSteps) {
        continue
      }

      if (
        !step.approverUser.isActive ||
        !step.approverUser.isRequestApprover ||
        step.approverUser.companyAccess.length === 0
      ) {
        continue
      }

      const targetStep = stepSummaryByStepNumber.get(step.stepNumber)
      if (!targetStep) {
        continue
      }

      if (step.stepName?.trim()) {
        targetStep.stepName = step.stepName.trim()
      }

      const approverName = `${step.approverUser.firstName} ${step.approverUser.lastName}`.trim()
      if (!targetStep.defaultApproverUserId) {
        targetStep.defaultApproverUserId = step.approverUserId
      }

      if (!targetStep.approvers.some((approver) => approver.approverUserId === step.approverUserId)) {
        targetStep.approvers.push({
          approverUserId: step.approverUserId,
          approverName,
        })
      }
    }

    const steps = Array.from(stepSummaryByStepNumber.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([stepNumber, value]) => ({
        stepNumber,
        stepName: value.stepName,
        defaultApproverUserId: value.defaultApproverUserId,
        approvers: value.approvers,
      }))

    const missingStepNumbers = steps
      .filter((step) => step.approvers.length === 0)
      .map((step) => step.stepNumber)

    return {
      departmentId: flow.departmentId,
      requiredSteps: flow.requiredSteps,
      missingStepNumbers,
      steps,
    }
  })

  return (
    <LegacyMaterialRequestSyncPage
      companyId={company.companyId}
      companyName={company.companyName}
      departments={departments}
      departmentApprovalFlows={departmentApprovalFlows}
    />
  )
}
