"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconBuilding,
  IconChecklist,
  IconChevronLeft,
  IconChevronRight,
  IconGitPullRequest,
  IconInfoCircle,
  IconPlus,
  IconSitemap,
  IconTrash,
} from "@tabler/icons-react"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
const FLOW_TABLE_PAGE_SIZE = 10

const Required = () => <span className="ml-1 text-destructive">*</span>
const fieldLabelClass = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground"

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

const getFlowStepSummaries = (flow: MaterialRequestApprovalSettingsViewModel["flows"][number]) => {
  return Array.from({ length: flow.requiredSteps }).map((_, stepIndex) => {
    const stepNumber = stepIndex + 1
    const approverNames = flow.steps
      .filter((step) => step.stepNumber === stepNumber)
      .map((step) => step.approverName)
    const stepName =
      flow.steps.find((step) => step.stepNumber === stepNumber)?.stepName?.trim() || getDefaultStepName(stepNumber)

    return {
      stepName,
      approverNames,
    }
  })
}

export function MaterialRequestApprovalSettingsPage({ data }: MaterialRequestApprovalSettingsPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const initialFlow = data.flows[0] ?? null
  const defaultDepartmentId = initialFlow?.departmentId ?? data.departments[0]?.id ?? ""

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(defaultDepartmentId)
  const [flowPage, setFlowPage] = useState(1)
  const [form, setForm] = useState<FlowForm>(
    initialFlow ? createFlowFormFromRow(initialFlow) : createEmptyFlowForm(defaultDepartmentId)
  )

  const flowByDepartmentId = useMemo(() => {
    return new Map(data.flows.map((flow) => [flow.departmentId, flow]))
  }, [data.flows])

  const selectedFlow = selectedDepartmentId ? flowByDepartmentId.get(selectedDepartmentId) ?? null : null
  const flowTotalPages = Math.max(1, Math.ceil(data.flows.length / FLOW_TABLE_PAGE_SIZE))
  const safeFlowPage = Math.min(flowPage, flowTotalPages)
  const pagedFlows = data.flows.slice(
    (safeFlowPage - 1) * FLOW_TABLE_PAGE_SIZE,
    safeFlowPage * FLOW_TABLE_PAGE_SIZE
  )

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
      <header className="relative overflow-hidden border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-4 top-2 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">System Settings</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                <IconGitPullRequest className="size-6 text-primary" />
                Material Request Approvals
              </h1>
              <Badge variant="outline" className="h-6 px-2 text-[11px]">
                <IconBuilding className="mr-1 size-3.5" />
                {data.companyName}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure per-department sequential approval steps (1-4) and assignees for material request routing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border border-border/60 bg-background/90 p-2">
            <Badge variant="outline">{data.flows.length} Department Flows</Badge>
            <Button asChild type="button" variant="ghost" size="sm" className="h-8 px-2">
              <Link href={`/${data.companyId}/settings/organization`}>
                <IconSitemap className="size-4" />
                Organization Setup
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-primary px-2 text-primary-foreground hover:bg-primary/90"
              onClick={openNewFlowForm}
            >
              <IconPlus className="size-4" />
              New Flow
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="border border-border/60">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="inline-flex items-center gap-2 text-base font-medium text-foreground">
              <IconChecklist className="size-4" />
              Department Approval Flow List
            </h2>
            <p className="text-sm text-muted-foreground">Click a department row to edit its flow.</p>
          </div>

          <div className="px-4 py-3">
            <div className="border border-border/60 bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.flows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-40 text-center text-sm text-muted-foreground">
                        No department approval flow configured yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedFlows.map((flow) => {
                      const isSelected = selectedDepartmentId === flow.departmentId
                      const stepSummaries = getFlowStepSummaries(flow)

                      return (
                        <TableRow
                          key={flow.id}
                          className={cn(
                            "cursor-pointer",
                            isSelected && "bg-muted/30 shadow-[inset_2px_0_0_theme(colors.primary)]"
                          )}
                          onClick={() => assignFormFromDepartment(flow.departmentId)}
                        >
                        <TableCell>
                            <p className="text-sm font-medium text-foreground">
                              {flow.departmentName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{flow.departmentCode}</p>
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
                          <div className="flex flex-wrap gap-1.5">
                              {stepSummaries.map((summary, summaryIndex) => (
                                <Badge
                                  key={`${summaryIndex}-${summary.stepName}`}
                                  variant="outline"
                                  className="text-[10px] font-normal"
                                  title={`${summary.stepName}: ${summary.approverNames.join(", ") || "-"}`}
                                >
                                  S{summaryIndex + 1}: {summary.approverNames.length}
                                </Badge>
                              ))}
                          </div>
                        </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {data.flows.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Page {safeFlowPage} of {flowTotalPages} • {data.flows.length} records
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={safeFlowPage <= 1}
                    onClick={() => setFlowPage((prev) => Math.max(1, prev - 1))}
                  >
                    <IconChevronLeft className="size-3.5" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={safeFlowPage >= flowTotalPages}
                    onClick={() => setFlowPage((prev) => Math.min(flowTotalPages, prev + 1))}
                  >
                    Next
                    <IconChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="border border-border/60 px-4 py-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-medium text-foreground">Flow Editor</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Flow editor guidance">
                        <IconInfoCircle className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                      Approvers can be from other subsidiaries as long as they have active access to {data.companyName} and are marked as request approvers.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedFlow ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="sm" className="h-8 px-2" disabled={isPending}>
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
                  ) : null}
                  <Button type="button" size="sm" className="h-8 px-2" onClick={handleSave} disabled={isPending}>
                    {isPending ? "Saving..." : selectedFlow ? "Update Flow" : "Save Flow"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className={fieldLabelClass}>
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
                <Label className={fieldLabelClass}>
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

              <div className="space-y-2">
                <Label className={fieldLabelClass}>Flow Active</Label>
                <div className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((previous) => ({ ...previous, isActive: checked }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {Array.from({ length: form.requiredSteps }).map((_, stepIndex) => (
                <div key={stepIndex} className="space-y-2 border border-border/60 bg-background/50 p-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <p className="text-sm font-medium text-foreground">Stage {stepIndex + 1}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {form.stepApproverUserIds[stepIndex].filter((value) => value.trim().length > 0).length} Assignee(s)
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => addStepApproverSlot(stepIndex)}
                      >
                        <IconPlus className="size-3.5" />
                        Add Approver
                      </Button>
                    </div>
                  </div>
                  <Label className={fieldLabelClass}>
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
                  <Label className={fieldLabelClass}>
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
                            variant="destructive"
                            size="sm"
                            className="px-3"
                            onClick={() => removeStepApproverSlot(stepIndex, approverIndex)}
                            disabled={form.stepApproverUserIds[stepIndex].length === 1}
                          >
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              {selectedFlow
                ? `Editing existing flow for ${selectedFlow.departmentName}.`
                : `Creating a new flow for ${selectedDepartmentName}.`}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
