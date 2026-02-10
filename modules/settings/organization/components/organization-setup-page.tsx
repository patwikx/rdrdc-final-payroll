"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { IconBriefcase, IconChartBar, IconEdit, IconGitBranch, IconMapPin, IconPlus, IconRefresh, IconSitemap } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { upsertOrganizationEntityAction } from "@/modules/settings/organization/actions/upsert-organization-entity-action"
import type { OrganizationOverviewData } from "@/modules/settings/organization/utils/get-organization-overview-data"

type OrganizationSetupPageProps = {
  data: OrganizationOverviewData
}

const tableClass = "text-xs"

type DepartmentForm = {
  id?: string
  code: string
  name: string
  description?: string
  parentId?: string
  displayOrder: number
  isActive: boolean
}

type DivisionForm = {
  id?: string
  code: string
  name: string
  description?: string
  parentId?: string
  displayOrder: number
  isActive: boolean
}

type RankForm = {
  id?: string
  code: string
  name: string
  description?: string
  level: number
  category?: string
  parentId?: string
  salaryGradeMin?: number
  salaryGradeMax?: number
  displayOrder: number
  isActive: boolean
}

type BranchForm = {
  id?: string
  code: string
  name: string
  description?: string
  city?: string
  province?: string
  region?: string
  country: string
  phone?: string
  email?: string
  minimumWageRegion?: string
  displayOrder: number
  isActive: boolean
}

type EntityTableRow = {
  id: string
  values: Array<string | React.ReactNode>
}

const renderActiveBadge = (isActive: boolean): React.ReactNode => {
  if (isActive) {
    return <Badge className="border-emerald-700 bg-emerald-600 text-white">Active</Badge>
  }

  return (
    <Badge variant="outline" className="border-border/70 text-muted-foreground">
      Inactive
    </Badge>
  )
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const createEmptyDepartmentForm = (): DepartmentForm => ({
  code: "",
  name: "",
  description: "",
  parentId: "",
  displayOrder: 1,
  isActive: true,
})

const createEmptyDivisionForm = (): DivisionForm => ({
  code: "",
  name: "",
  description: "",
  parentId: "",
  displayOrder: 1,
  isActive: true,
})

const createEmptyRankForm = (): RankForm => ({
  code: "",
  name: "",
  description: "",
  level: 1,
  category: "",
  parentId: "",
  salaryGradeMin: undefined,
  salaryGradeMax: undefined,
  displayOrder: 1,
  isActive: true,
})

const createEmptyBranchForm = (): BranchForm => ({
  code: "",
  name: "",
  description: "",
  city: "",
  province: "",
  region: "",
  country: "Philippines",
  phone: "",
  email: "",
  minimumWageRegion: "",
  displayOrder: 1,
  isActive: true,
})

export function OrganizationSetupPage({ data }: OrganizationSetupPageProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false)
  const [divisionDialogOpen, setDivisionDialogOpen] = useState(false)
  const [rankDialogOpen, setRankDialogOpen] = useState(false)
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)

  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>(createEmptyDepartmentForm())
  const [divisionForm, setDivisionForm] = useState<DivisionForm>(createEmptyDivisionForm())
  const [rankForm, setRankForm] = useState<RankForm>(createEmptyRankForm())
  const [branchForm, setBranchForm] = useState<BranchForm>(createEmptyBranchForm())

  const roleLabel = useMemo(() => data.companyRole.split("_").join(" "), [data.companyRole])

  const resetForms = () => {
    setDepartmentForm(createEmptyDepartmentForm())
    setDivisionForm(createEmptyDivisionForm())
    setRankForm(createEmptyRankForm())
    setBranchForm(createEmptyBranchForm())
  }

  const handleEditDepartment = (id: string) => {
    const record = data.departments.find((item) => item.id === id)
    if (!record) return

    setDepartmentForm({
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description ?? "",
      parentId: record.parentId ?? "",
      displayOrder: record.displayOrder,
      isActive: record.isActive,
    })
    setDepartmentDialogOpen(true)
  }

  const handleEditDivision = (id: string) => {
    const record = data.divisions.find((item) => item.id === id)
    if (!record) return

    setDivisionForm({
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description ?? "",
      parentId: record.parentId ?? "",
      displayOrder: record.displayOrder,
      isActive: record.isActive,
    })
    setDivisionDialogOpen(true)
  }

  const handleEditRank = (id: string) => {
    const record = data.ranks.find((item) => item.id === id)
    if (!record) return

    setRankForm({
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description ?? "",
      level: record.level,
      category: record.category ?? "",
      parentId: record.parentId ?? "",
      salaryGradeMin: record.salaryGradeMin ?? undefined,
      salaryGradeMax: record.salaryGradeMax ?? undefined,
      displayOrder: record.displayOrder,
      isActive: record.isActive,
    })
    setRankDialogOpen(true)
  }

  const handleEditBranch = (id: string) => {
    const record = data.branches.find((item) => item.id === id)
    if (!record) return

    setBranchForm({
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description ?? "",
      city: record.city ?? "",
      province: record.province ?? "",
      region: record.region ?? "",
      country: record.country,
      phone: record.phone ?? "",
      email: record.email ?? "",
      minimumWageRegion: record.minimumWageRegion ?? "",
      displayOrder: record.displayOrder,
      isActive: record.isActive,
    })
    setBranchDialogOpen(true)
  }

  const handleSaveDepartment = () => {
    startTransition(async () => {
      const result = await upsertOrganizationEntityAction({
        companyId: data.companyId,
        entity: "departments",
        payload: {
          id: departmentForm.id,
          code: departmentForm.code,
          name: departmentForm.name,
          description: departmentForm.description,
          parentId: departmentForm.parentId,
          displayOrder: departmentForm.displayOrder,
          isActive: departmentForm.isActive,
        },
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setDepartmentDialogOpen(false)
      resetForms()
      router.refresh()
    })
  }

  const handleSaveDivision = () => {
    startTransition(async () => {
      const result = await upsertOrganizationEntityAction({
        companyId: data.companyId,
        entity: "divisions",
        payload: {
          id: divisionForm.id,
          code: divisionForm.code,
          name: divisionForm.name,
          description: divisionForm.description,
          parentId: divisionForm.parentId,
          displayOrder: divisionForm.displayOrder,
          isActive: divisionForm.isActive,
        },
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setDivisionDialogOpen(false)
      resetForms()
      router.refresh()
    })
  }

  const handleSaveRank = () => {
    startTransition(async () => {
      const result = await upsertOrganizationEntityAction({
        companyId: data.companyId,
        entity: "ranks",
        payload: {
          id: rankForm.id,
          code: rankForm.code,
          name: rankForm.name,
          description: rankForm.description,
          level: rankForm.level,
          category: rankForm.category,
          parentId: rankForm.parentId,
          salaryGradeMin: rankForm.salaryGradeMin,
          salaryGradeMax: rankForm.salaryGradeMax,
          displayOrder: rankForm.displayOrder,
          isActive: rankForm.isActive,
        },
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setRankDialogOpen(false)
      resetForms()
      router.refresh()
    })
  }

  const handleSaveBranch = () => {
    startTransition(async () => {
      const result = await upsertOrganizationEntityAction({
        companyId: data.companyId,
        entity: "branches",
        payload: {
          id: branchForm.id,
          code: branchForm.code,
          name: branchForm.name,
          description: branchForm.description,
          city: branchForm.city,
          province: branchForm.province,
          region: branchForm.region,
          country: branchForm.country,
          phone: branchForm.phone,
          email: branchForm.email,
          minimumWageRegion: branchForm.minimumWageRegion,
          displayOrder: branchForm.displayOrder,
          isActive: branchForm.isActive,
        },
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setBranchDialogOpen(false)
      resetForms()
      router.refresh()
    })
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"><IconSitemap className="size-5" /> {data.companyName} Organization View</h1>
            <p className="text-sm text-muted-foreground">Manage departments, divisions, ranks, and branches with table-based workflows.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{data.companyCode}</Badge>
            <Badge variant="outline">Role: {roleLabel}</Badge>
            <Button type="button" variant="ghost" onClick={resetForms} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset Forms
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <EntityTableCard
          className="lg:col-span-2"
          title="Departments"
          description="Company department records"
          icon={<IconBriefcase className="size-4" />}
          headers={["Code", "Name", "Parent", "Order", "Status", "Action"]}
          rows={data.departments.map((item) => ({
            id: item.id,
            values: [
              item.code,
              item.name,
              item.parentLabel ?? "-",
              String(item.displayOrder),
              renderActiveBadge(item.isActive),
            ],
          }))}
          onEdit={handleEditDepartment}
          dialog={
            <DepartmentDialog
              open={departmentDialogOpen}
              onOpenChange={setDepartmentDialogOpen}
              form={departmentForm}
              setForm={setDepartmentForm}
              options={data.departments.map((item) => ({ id: item.id, code: item.code, name: item.name }))}
              onSubmit={handleSaveDepartment}
              isPending={isPending}
              onCreate={() => setDepartmentForm(createEmptyDepartmentForm())}
            />
          }
        />

        <EntityTableCard
          className=""
          title="Divisions"
          description="Company division records"
          icon={<IconGitBranch className="size-4" />}
          headers={["Code", "Name", "Parent", "Order", "Status", "Action"]}
          rows={data.divisions.map((item) => ({
            id: item.id,
            values: [
              item.code,
              item.name,
              item.parentLabel ?? "-",
              String(item.displayOrder),
              renderActiveBadge(item.isActive),
            ],
          }))}
          onEdit={handleEditDivision}
          dialog={
            <DivisionDialog
              open={divisionDialogOpen}
              onOpenChange={setDivisionDialogOpen}
              form={divisionForm}
              setForm={setDivisionForm}
              options={data.divisions.map((item) => ({ id: item.id, code: item.code, name: item.name }))}
              onSubmit={handleSaveDivision}
              isPending={isPending}
              onCreate={() => setDivisionForm(createEmptyDivisionForm())}
            />
          }
        />

        <EntityTableCard
          className=""
          title="Ranks"
          description="Company rank records"
          icon={<IconChartBar className="size-4" />}
          headers={["Code", "Name", "Level", "Category", "Status", "Action"]}
          rows={data.ranks.map((item) => ({
            id: item.id,
            values: [
              item.code,
              item.name,
              String(item.level),
              item.category ?? "-",
              renderActiveBadge(item.isActive),
            ],
          }))}
          onEdit={handleEditRank}
          dialog={
            <RankDialog
              open={rankDialogOpen}
              onOpenChange={setRankDialogOpen}
              form={rankForm}
              setForm={setRankForm}
              options={data.ranks.map((item) => ({ id: item.id, code: item.code, name: item.name }))}
              onSubmit={handleSaveRank}
              isPending={isPending}
              onCreate={() => setRankForm(createEmptyRankForm())}
            />
          }
        />

        <EntityTableCard
          className="lg:col-span-2"
          title="Branches"
          description="Company branch records"
          icon={<IconMapPin className="size-4" />}
          headers={["Code", "Name", "Location", "Phone", "Status", "Action"]}
          rows={data.branches.map((item) => ({
            id: item.id,
            values: [
              item.code,
              item.name,
              [item.city, item.province, item.region].filter(Boolean).join(", ") || item.country,
              item.phone ?? "-",
              renderActiveBadge(item.isActive),
            ],
          }))}
          onEdit={handleEditBranch}
          dialog={
            <BranchDialog
              open={branchDialogOpen}
              onOpenChange={setBranchDialogOpen}
              form={branchForm}
              setForm={setBranchForm}
              onSubmit={handleSaveBranch}
              isPending={isPending}
              onCreate={() => setBranchForm(createEmptyBranchForm())}
            />
          }
        />
      </div>
    </main>
  )
}

function EntityTableCard({
  className,
  title,
  description,
  icon,
  headers,
  rows,
  onEdit,
  dialog,
}: {
  className?: string
  title: string
  description: string
  icon: React.ReactNode
  headers: string[]
  rows: EntityTableRow[]
  onEdit: (id: string) => void
  dialog: React.ReactNode
}) {
  return (
    <section className={cn("border border-border/60 bg-background", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-base font-medium text-foreground">
            {icon}
            <span>{title}</span>
          </p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {dialog}
      </div>
      <div className="p-4">
        <div className="overflow-x-auto border border-border/60">
          <table className={`w-full ${tableClass}`}>
            <thead className="bg-muted/50">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-4 text-center text-muted-foreground">
                    No records yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/50">
                    {row.values.map((value, valueIndex) => (
                      <td key={valueIndex} className="px-3 py-2 text-foreground">
                        {value}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(row.id)}>
                        <IconEdit className="size-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function DepartmentDialog({
  open,
  onOpenChange,
  form,
  setForm,
  options,
  onSubmit,
  isPending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: DepartmentForm
  setForm: React.Dispatch<React.SetStateAction<DepartmentForm>>
  options: Array<{ id: string; code: string; name: string }>
  onSubmit: () => void
  isPending: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" onClick={onCreate}><IconPlus className="size-3.5" /> Add Department</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Department Form</DialogTitle>
          <DialogDescription>Create or update a department record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(event) => setForm((p) => ({ ...p, code: event.target.value }))} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))} /></Field>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
            <Field label="Parent">
              <Select value={form.parentId || "none"} onValueChange={(value) => setForm((p) => ({ ...p, parentId: value === "none" ? "" : value }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="No parent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {options.filter((item) => item.id !== form.id).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.code} - {item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Order" required><Input type="number" value={form.displayOrder} onChange={(event) => setForm((p) => ({ ...p, displayOrder: Number(event.target.value) }))} /></Field>
            <Field label="Active">
              <div className="flex h-7 items-center justify-between rounded-md border border-border/70 bg-background px-2">
                <span className="text-[11px] text-muted-foreground">Status</span>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))} />
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea className="h-16" value={form.description || ""} onChange={(event) => setForm((p) => ({ ...p, description: event.target.value }))} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DivisionDialog({
  open,
  onOpenChange,
  form,
  setForm,
  options,
  onSubmit,
  isPending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: DivisionForm
  setForm: React.Dispatch<React.SetStateAction<DivisionForm>>
  options: Array<{ id: string; code: string; name: string }>
  onSubmit: () => void
  isPending: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" onClick={onCreate}><IconPlus className="size-3.5" /> Add Division</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Division Form</DialogTitle>
          <DialogDescription>Create or update a division record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(event) => setForm((p) => ({ ...p, code: event.target.value }))} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))} /></Field>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
            <Field label="Parent">
              <Select value={form.parentId || "none"} onValueChange={(value) => setForm((p) => ({ ...p, parentId: value === "none" ? "" : value }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="No parent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {options.filter((item) => item.id !== form.id).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.code} - {item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Order" required><Input type="number" value={form.displayOrder} onChange={(event) => setForm((p) => ({ ...p, displayOrder: Number(event.target.value) }))} /></Field>
            <Field label="Active">
              <div className="flex h-7 items-center justify-between rounded-md border border-border/70 bg-background px-2">
                <span className="text-[11px] text-muted-foreground">Status</span>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))} />
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea className="h-16" value={form.description || ""} onChange={(event) => setForm((p) => ({ ...p, description: event.target.value }))} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RankDialog({
  open,
  onOpenChange,
  form,
  setForm,
  options,
  onSubmit,
  isPending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: RankForm
  setForm: React.Dispatch<React.SetStateAction<RankForm>>
  options: Array<{ id: string; code: string; name: string }>
  onSubmit: () => void
  isPending: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" onClick={onCreate}><IconPlus className="size-3.5" /> Add Rank</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rank Form</DialogTitle>
          <DialogDescription>Create or update a rank record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(event) => setForm((p) => ({ ...p, code: event.target.value }))} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))} /></Field>
          <Field label="Level" required><Input type="number" value={form.level} onChange={(event) => setForm((p) => ({ ...p, level: Number(event.target.value) }))} /></Field>
          <Field label="Category"><Input value={form.category || ""} onChange={(event) => setForm((p) => ({ ...p, category: event.target.value }))} /></Field>
          <Field label="Parent Rank">
            <Select value={form.parentId || "none"} onValueChange={(value) => setForm((p) => ({ ...p, parentId: value === "none" ? "" : value }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="No parent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent</SelectItem>
                {options.filter((item) => item.id !== form.id).map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.code} - {item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Salary Min"><Input type="number" value={form.salaryGradeMin ?? ""} onChange={(event) => setForm((p) => ({ ...p, salaryGradeMin: event.target.value === "" ? undefined : Number(event.target.value) }))} /></Field>
          <Field label="Salary Max"><Input type="number" value={form.salaryGradeMax ?? ""} onChange={(event) => setForm((p) => ({ ...p, salaryGradeMax: event.target.value === "" ? undefined : Number(event.target.value) }))} /></Field>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
            <Field label="Order" required><Input type="number" value={form.displayOrder} onChange={(event) => setForm((p) => ({ ...p, displayOrder: Number(event.target.value) }))} /></Field>
            <Field label="Active">
              <div className="flex h-7 items-center justify-between rounded-md border border-border/70 bg-background px-2">
                <span className="text-[11px] text-muted-foreground">Status</span>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))} />
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea className="h-16" value={form.description || ""} onChange={(event) => setForm((p) => ({ ...p, description: event.target.value }))} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BranchDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isPending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: BranchForm
  setForm: React.Dispatch<React.SetStateAction<BranchForm>>
  onSubmit: () => void
  isPending: boolean
  onCreate: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" onClick={onCreate}><IconPlus className="size-3.5" /> Add Branch</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Branch Form</DialogTitle>
          <DialogDescription>Create or update a branch record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required><Input value={form.code} onChange={(event) => setForm((p) => ({ ...p, code: event.target.value }))} /></Field>
          <Field label="Name" required><Input value={form.name} onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))} /></Field>
          <Field label="City"><Input value={form.city || ""} onChange={(event) => setForm((p) => ({ ...p, city: event.target.value }))} /></Field>
          <Field label="Province"><Input value={form.province || ""} onChange={(event) => setForm((p) => ({ ...p, province: event.target.value }))} /></Field>
          <Field label="Region"><Input value={form.region || ""} onChange={(event) => setForm((p) => ({ ...p, region: event.target.value }))} /></Field>
          <Field label="Country" required><Input value={form.country} onChange={(event) => setForm((p) => ({ ...p, country: event.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.phone || ""} onChange={(event) => setForm((p) => ({ ...p, phone: event.target.value }))} /></Field>
          <Field label="Email"><Input type="email" value={form.email || ""} onChange={(event) => setForm((p) => ({ ...p, email: event.target.value }))} /></Field>
          <Field label="Minimum Wage Region"><Input value={form.minimumWageRegion || ""} onChange={(event) => setForm((p) => ({ ...p, minimumWageRegion: event.target.value }))} /></Field>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
            <Field label="Order" required><Input type="number" value={form.displayOrder} onChange={(event) => setForm((p) => ({ ...p, displayOrder: Number(event.target.value) }))} /></Field>
            <Field label="Active">
              <div className="flex h-7 items-center justify-between rounded-md border border-border/70 bg-background px-2">
                <span className="text-[11px] text-muted-foreground">Status</span>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((p) => ({ ...p, isActive: checked }))} />
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea className="h-16" value={form.description || ""} onChange={(event) => setForm((p) => ({ ...p, description: event.target.value }))} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required ? <Required /> : null}
      </Label>
      {children}
    </div>
  )
}
