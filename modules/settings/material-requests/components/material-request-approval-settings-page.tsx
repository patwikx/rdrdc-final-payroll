"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconChecklist, IconGitPullRequest, IconPlus, IconSitemap, IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  deleteDepartmentMaterialRequestApprovalFlowAction,
  upsertDepartmentMaterialRequestApprovalFlowAction,
} from "@/modules/material-requests/actions/department-approval-flow-actions"
import type { MaterialRequestApprovalSettingsViewModel } from "@/modules/settings/material-requests/utils/get-material-request-approval-settings-view-model"

type MaterialRequestApprovalSettingsPageProps = {
  data: MaterialRequestApprovalSettingsViewModel
}

type FlowForm = {
  departmentId: string
  requiredSteps: number
  isActive: boolean
  stepNames: [string, string, string, string]
  stepApproverUserIds: [string[], string[], string[], string[]]
}

const REQUIRED_STEP_OPTIONS = [1, 2, 3, 4] as const

const Required = () => <span className="ml-1 text-destructive">*</span>

const getDefaultStepName = (stepNumber: number): string => `Step ${stepNumber}`

const createEmptyFlowForm = (departmentId: string): FlowForm => ({
  departmentId,
  requiredSteps: 1,
  isActive: true,
  stepNames: [getDefaultStepName(1), getDefaultStepName(2), getDefaultStepName(3), getDefaultStepName(4)],
  stepApproverUserIds: [[""], [""], [""], [""]],
})

const normalizeStepApproverSlots = (stepApproverUserIds: [string[], string[], string[], string[]]) => {
  return stepApproverUserIds.map((stepApprovers) => (stepApprovers.length > 0 ? stepApprovers : [""])) as [
    string[],
    string[],
    string[],
    string[],
  ]
}

const createFlowFormFromRow = (
  flow: MaterialRequestApprovalSettingsViewModel["flows"][number]
): FlowForm => {
  const stepApproverUserIds: [string[], string[], string[], string[]] = [[], [], [], []]
  const stepNames: [string, string, string, string] = [
    getDefaultStepName(1),
    getDefaultStepName(2),
    getDefaultStepName(3),
    getDefaultStepName(4),
  ]

  for (const step of flow.steps) {
    const index = step.stepNumber - 1
    if (index >= 0 && index < 4) {
      stepNames[index] = step.stepName?.trim() || getDefaultStepName(step.stepNumber)
      stepApproverUserIds[index].push(step.approverUserId)
    }
  }

  return {
    departmentId: flow.departmentId,
    requiredSteps: flow.requiredSteps,
    isActive: flow.isActive,
    stepNames,
    stepApproverUserIds: normalizeStepApproverSlots(stepApproverUserIds),
  }
}

export function MaterialRequestApprovalSettingsPage({ data }: MaterialRequestApprovalSettingsPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const initialFlow = data.flows[0] ?? null
  const defaultDepartmentId = initialFlow?.departmentId ?? data.departments[0]?.id ?? ""

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(defaultDepartmentId)
  const [form, setForm] = useState<FlowForm>(
    initialFlow ? createFlowFormFromRow(initialFlow) : createEmptyFlowForm(defaultDepartmentId)
  )

  const flowByDepartmentId = useMemo(() => {
    return new Map(data.flows.map((flow) => [flow.departmentId, flow]))
  }, [data.flows])

  const selectedFlow = selectedDepartmentId ? flowByDepartmentId.get(selectedDepartmentId) ?? null : null

  const assignFormFromDepartment = (departmentId: string) => {
    const existingFlow = flowByDepartmentId.get(departmentId)

    setSelectedDepartmentId(departmentId)

    if (existingFlow) {
      setForm(createFlowFormFromRow(existingFlow))
      return
    }

    setForm(createEmptyFlowForm(departmentId))
  }

  const openNewFlowForm = () => {
    const firstDepartmentWithoutFlow = data.departments.find(
      (department) => !flowByDepartmentId.has(department.id)
    )
    const targetDepartmentId = firstDepartmentWithoutFlow?.id ?? data.departments[0]?.id ?? ""

    setSelectedDepartmentId(targetDepartmentId)
    setForm(createEmptyFlowForm(targetDepartmentId))
  }

  const updateApprover = (stepIndex: number, approverIndex: number, userId: string) => {
    setForm((previous) => {
      const nextStepApproverUserIds = previous.stepApproverUserIds.map((stepApprovers) => [...stepApprovers]) as [
        string[],
        string[],
        string[],
        string[],
      ]
      nextStepApproverUserIds[stepIndex][approverIndex] = userId === "__UNSET__" ? "" : userId

      return {
        ...previous,
        stepApproverUserIds: nextStepApproverUserIds,
      }
    })
  }

  const addStepApproverSlot = (stepIndex: number) => {
    setForm((previous) => {
      const nextStepApproverUserIds = previous.stepApproverUserIds.map((stepApprovers) => [...stepApprovers]) as [
        string[],
        string[],
        string[],
        string[],
      ]
      nextStepApproverUserIds[stepIndex].push("")

      return {
        ...previous,
        stepApproverUserIds: nextStepApproverUserIds,
      }
    })
  }

  const removeStepApproverSlot = (stepIndex: number, approverIndex: number) => {
    setForm((previous) => {
      const nextStepApproverUserIds = previous.stepApproverUserIds.map((stepApprovers) => [...stepApprovers]) as [
        string[],
        string[],
        string[],
        string[],
      ]
      const currentStepApprovers = nextStepApproverUserIds[stepIndex]

      if (currentStepApprovers.length <= 1) {
        currentStepApprovers[0] = ""
      } else {
        currentStepApprovers.splice(approverIndex, 1)
      }

      return {
        ...previous,
        stepApproverUserIds: nextStepApproverUserIds,
      }
    })
  }

  const handleSave = () => {
    if (!form.departmentId) {
      toast.error("Department is required.")
      return
    }

    const selectedApproverSteps: Array<{
      stepNumber: number
      stepName: string
      approverUserId: string
    }> = []

    for (let index = 0; index < form.requiredSteps; index += 1) {
      const stepNumber = index + 1
      const stepName = form.stepNames[index].trim()

      if (!stepName) {
        toast.error(`Step ${stepNumber} name is required.`)
        return
      }

      const selectedForStep = form.stepApproverUserIds[index]
        .map((approverUserId) => approverUserId.trim())
        .filter((approverUserId) => approverUserId.length > 0)

      if (selectedForStep.length === 0) {
        toast.error(`At least one approver is required for ${stepName}.`)
        return
      }

      for (const approverUserId of selectedForStep) {
        selectedApproverSteps.push({
          stepNumber,
          stepName,
          approverUserId,
        })
      }
    }

    startTransition(async () => {
      const response = await upsertDepartmentMaterialRequestApprovalFlowAction({
        companyId: data.companyId,
        departmentId: form.departmentId,
        requiredSteps: form.requiredSteps,
        isActive: form.isActive,
        steps: selectedApproverSteps,
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!form.departmentId) {
      toast.error("Select a department flow to delete.")
      return
    }

    startTransition(async () => {
      const response = await deleteDepartmentMaterialRequestApprovalFlowAction({
        companyId: data.companyId,
        departmentId: form.departmentId,
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      toast.success(response.message)
      router.refresh()
    })
  }

  const selectedDepartmentName =
    data.departments.find((department) => department.id === form.departmentId)?.name ?? "Selected department"

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <IconGitPullRequest className="size-5" />
              {data.companyName} Material Request Approvals
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure per-department sequential approval steps (1 to 4). This settings page is admin-side and outside Employee Portal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="ghost">
              <Link href={`/${data.companyId}/settings/organization`}>
                <IconSitemap className="size-4" />
                Organization Setup
              </Link>
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openNewFlowForm}
            >
              <IconPlus className="size-4" />
              New Flow
            </Button>
          </div>
        </div>
      </header>

      <section className="grid border-y border-border/60 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="xl:border-r xl:border-border/60">
          <div className="border-b border-border/60 px-4 py-3 sm:px-6">
            <h2 className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
              <IconChecklist className="size-4" />
              Department Approval Flow List
            </h2>
            <p className="text-xs text-muted-foreground">Click a department row to edit its flow.</p>
          </div>

          <div className="px-4 py-3 sm:px-6">
            <div className="overflow-hidden border border-border/60 bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Department</TableHead>
                    <TableHead>Required Steps</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approvers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.flows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-sm text-muted-foreground">
                        No department approval flow configured yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.flows.map((flow) => (
                      <TableRow
                        key={flow.id}
                        className={cn(
                          "cursor-pointer",
                          selectedDepartmentId === flow.departmentId && "bg-primary/10"
                        )}
                        onClick={() => assignFormFromDepartment(flow.departmentId)}
                      >
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{flow.departmentName}</p>
                          <p className="text-xs text-muted-foreground">{flow.departmentCode}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {flow.requiredSteps}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={flow.isActive ? "default" : "secondary"}
                            className={flow.isActive ? "bg-green-600 text-white hover:bg-green-600" : ""}
                          >
                            {flow.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground">
                            {Array.from({ length: flow.requiredSteps })
                              .map((_, stepIndex) => {
                                const stepNumber = stepIndex + 1
                                const names = flow.steps
                                  .filter((step) => step.stepNumber === stepNumber)
                                  .map((step) => step.approverName)
                                const stepName =
                                  flow.steps.find((step) => step.stepNumber === stepNumber)?.stepName?.trim() ||
                                  getDefaultStepName(stepNumber)

                                if (names.length === 0) {
                                  return `${stepName}: -`
                                }

                                return `${stepName}: ${names.join(", ")}`
                              })
                              .join(" | ")}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>

        <section className="px-4 py-4 sm:px-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Flow Editor</h3>
              <p className="text-xs text-muted-foreground">
                Approvers can be from other subsidiaries as long as they have active access to {data.companyName} and are marked as request approvers.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Department<Required />
                </Label>
                <Select
                  value={form.departmentId || "__UNSET__"}
                  onValueChange={(value) => {
                    if (value === "__UNSET__") {
                      return
                    }

                    assignFormFromDepartment(value)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                        {!department.isActive ? " (Inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground">
                  Required Steps<Required />
                </Label>
                <Select
                  value={String(form.requiredSteps)}
                  onValueChange={(value) => {
                    const parsed = Number(value)
                    if (!Number.isInteger(parsed)) {
                      return
                    }

                    setForm((previous) => ({
                      ...previous,
                      requiredSteps: parsed,
                    }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select step count" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUIRED_STEP_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option} Step{option > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 p-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((previous) => ({ ...previous, isActive: checked }))}
              />
              <div>
                <p className="text-xs font-medium text-foreground">Flow Active</p>
                <p className="text-xs text-muted-foreground">Inactive flows cannot be used for request submission.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground">Step Approvers</p>
              {Array.from({ length: form.requiredSteps }).map((_, stepIndex) => (
                <div key={stepIndex} className="space-y-2 rounded-md border border-border/60 bg-background/50 p-3">
                  <Label className="text-xs text-foreground">
                    Stage Name<Required />
                  </Label>
                  <Input
                    value={form.stepNames[stepIndex]}
                    onChange={(event) =>
                      setForm((previous) => {
                        const nextStepNames = [...previous.stepNames] as [string, string, string, string]
                        nextStepNames[stepIndex] = event.target.value

                        return {
                          ...previous,
                          stepNames: nextStepNames,
                        }
                      })
                    }
                    placeholder={getDefaultStepName(stepIndex + 1)}
                    maxLength={60}
                  />
                  <Label className="text-xs text-foreground">
                    {form.stepNames[stepIndex].trim() || getDefaultStepName(stepIndex + 1)} Assignee(s)<Required />
                  </Label>
                  <div className="space-y-2">
                    {form.stepApproverUserIds[stepIndex].map((approverUserId, approverIndex) => {
                      const selectedInOtherStepSlots = new Set(
                        form.stepApproverUserIds[stepIndex].filter((otherApproverUserId, otherApproverIndex) => {
                          if (!otherApproverUserId) {
                            return false
                          }

                          return otherApproverIndex !== approverIndex
                        })
                      )

                      return (
                        <div
                          key={`${stepIndex}-${approverIndex}`}
                          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div className="space-y-1">
                            <Select
                              value={approverUserId || "__UNSET__"}
                              onValueChange={(value) =>
                                updateApprover(stepIndex, approverIndex, value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select approver" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__UNSET__">Select approver</SelectItem>
                                {data.approvers.map((approver) => (
                                  <SelectItem
                                    key={approver.userId}
                                    value={approver.userId}
                                    disabled={selectedInOtherStepSlots.has(approver.userId)}
                                  >
                                    {approver.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeStepApproverSlot(stepIndex, approverIndex)}
                            disabled={form.stepApproverUserIds[stepIndex].length === 1}
                          >
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStepApproverSlot(stepIndex)}
                  >
                    <IconPlus className="size-3.5" />
                    Add Approver
                  </Button>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              {selectedFlow
                ? `Editing existing flow for ${selectedFlow.departmentName}.`
                : `Creating a new flow for ${selectedDepartmentName}.`}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
              {selectedFlow ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={isPending}>
                      <IconTrash className="size-4" />
                      Delete Flow
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Department Flow</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the material-request approval flow for {selectedFlow.departmentName}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleDelete}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <span className="text-xs text-muted-foreground">Select a saved flow to enable delete.</span>
              )}

              <Button type="button" onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving..." : selectedFlow ? "Update Flow" : "Save Flow"}
              </Button>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
