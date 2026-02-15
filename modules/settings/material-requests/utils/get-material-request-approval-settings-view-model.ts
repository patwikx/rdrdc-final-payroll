import { db } from "@/lib/db"

export type MaterialRequestApprovalSettingsViewModel = {
  companyId: string
  companyName: string
  departments: Array<{
    id: string
    code: string
    name: string
    isActive: boolean
  }>
  approvers: Array<{
    userId: string
    fullName: string
    email: string
    companyRole: string
  }>
  flows: Array<{
    id: string
    departmentId: string
    departmentName: string
    departmentCode: string
    requiredSteps: number
    isActive: boolean
    steps: Array<{
      id: string
      stepNumber: number
      stepName: string | null
      approverUserId: string
      approverName: string
      approverEmail: string
      approverCompanyRole: string | null
    }>
  }>
}

export async function getMaterialRequestApprovalSettingsViewModel(params: {
  companyId: string
  companyName: string
}): Promise<MaterialRequestApprovalSettingsViewModel> {
  const [departments, approverAccess, flowsRaw] = await Promise.all([
    db.department.findMany({
      where: {
        companyId: params.companyId,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    }),
    db.userCompanyAccess.findMany({
      where: {
        companyId: params.companyId,
        isActive: true,
        user: {
          isActive: true,
          isRequestApprover: true,
        },
      },
      orderBy: [
        { role: "asc" },
        { user: { firstName: "asc" } },
        { user: { lastName: "asc" } },
      ],
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    db.departmentMaterialRequestApprovalFlow.findMany({
      where: {
        companyId: params.companyId,
      },
      orderBy: [
        {
          department: {
            name: "asc",
          },
        },
      ],
      select: {
        id: true,
        departmentId: true,
        requiredSteps: true,
        isActive: true,
        department: {
          select: {
            name: true,
            code: true,
          },
        },
        steps: {
          orderBy: {
            stepNumber: "asc",
          },
          select: {
            id: true,
            stepNumber: true,
            stepName: true,
            approverUserId: true,
            approverUser: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                companyAccess: {
                  where: {
                    companyId: params.companyId,
                    isActive: true,
                  },
                  select: {
                    role: true,
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

  return {
    companyId: params.companyId,
    companyName: params.companyName,
    departments,
    approvers: approverAccess.map((access) => ({
      userId: access.userId,
      fullName: `${access.user.firstName} ${access.user.lastName}`,
      email: access.user.email,
      companyRole: access.role,
    })),
    flows: flowsRaw.map((flow) => ({
      id: flow.id,
      departmentId: flow.departmentId,
      departmentName: flow.department.name,
      departmentCode: flow.department.code,
      requiredSteps: flow.requiredSteps,
      isActive: flow.isActive,
      steps: flow.steps.map((step) => ({
        id: step.id,
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        approverUserId: step.approverUserId,
        approverName: `${step.approverUser.firstName} ${step.approverUser.lastName}`,
        approverEmail: step.approverUser.email,
        approverCompanyRole: step.approverUser.companyAccess[0]?.role ?? null,
      })),
    })),
  }
}
