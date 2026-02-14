"use client"

import { useState, useTransition } from "react"
import type { ComponentType, ReactNode } from "react"
import { IconEdit, IconPlus, IconTrash, IconUsers } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import {
  createBeneficiaryAction,
  createDependentAction,
  createEducationAction,
  deleteBeneficiaryAction,
  deleteDependentAction,
  deleteEducationAction,
  updateBeneficiaryAction,
  updateDependentAction,
  updateEducationAction,
} from "@/modules/employees/profile/actions/education-family-crud-actions"
import type { EmployeeProfileViewModel } from "@/modules/employees/profile/utils/get-employee-profile-data"

type EmployeeData = EmployeeProfileViewModel["employee"]
type OptionsData = EmployeeProfileViewModel["options"]

type DependentForm = {
  dependentId: string | null
  firstName: string
  middleName: string
  lastName: string
  relationshipId: string
  birthDate: string
  isTaxDependent: boolean
}

type BeneficiaryForm = {
  beneficiaryId: string | null
  name: string
  relationshipId: string
  percentage: string
  contactNumber: string
}

type EducationForm = {
  educationId: string | null
  educationLevelId: string
  schoolName: string
  course: string
  yearGraduated: string
}

type DeleteTarget =
  | { kind: "dependent"; id: string }
  | { kind: "beneficiary"; id: string }
  | { kind: "education"; id: string }

const emptyDependentForm = (): DependentForm => ({
  dependentId: null,
  firstName: "",
  middleName: "",
  lastName: "",
  relationshipId: "",
  birthDate: "",
  isTaxDependent: false,
})

const emptyBeneficiaryForm = (): BeneficiaryForm => ({
  beneficiaryId: null,
  name: "",
  relationshipId: "",
  percentage: "",
  contactNumber: "",
})

const emptyEducationForm = (): EducationForm => ({
  educationId: null,
  educationLevelId: "",
  schoolName: "",
  course: "",
  yearGraduated: "",
})

const toDateLabel = (value: string): string => {
  const date = parsePhDateInputToPhDate(value)
  if (!date) return "Select date"
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date)
}

function RequiredLabel({ label }: { label: string }) {
  return (
    <Label>
      {label} <span className="text-destructive">*</span>
    </Label>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            {value ? toDateLabel(value) : "Select date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? (parsePhDateInputToPhDate(value) ?? undefined) : undefined}
            onSelect={(date) => onChange(toPhDateInputValue(date))}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function SectionHeader({
  title,
  number,
  icon: Icon,
  action,
}: {
  title: string
  number: string
  icon: ComponentType<{ className?: string }>
  action?: ReactNode
}) {
  return (
    <div className="mb-6 mt-4 flex items-center justify-between gap-3 border-b border-primary/20 pb-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        <span className="text-xs font-medium text-primary/60">#{number}</span>
        <span className="h-3 w-px bg-primary/20" />
        <Icon className="size-3.5" /> {title}
      </h3>
      {action ? <div>{action}</div> : null}
    </div>
  )
}

function Empty({ message = "No records found." }: { message?: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center border border-dashed border-border/70 p-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function EmployeeEducationFamilyTab({ companyId, employee, options }: { companyId: string; employee: EmployeeData; options: OptionsData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [dependentDialogOpen, setDependentDialogOpen] = useState(false)
  const [beneficiaryDialogOpen, setBeneficiaryDialogOpen] = useState(false)
  const [educationDialogOpen, setEducationDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const [dependentForm, setDependentForm] = useState<DependentForm>(emptyDependentForm())
  const [beneficiaryForm, setBeneficiaryForm] = useState<BeneficiaryForm>(emptyBeneficiaryForm())
  const [educationForm, setEducationForm] = useState<EducationForm>(emptyEducationForm())

  const refreshWithSuccess = (message: string) => {
    toast.success(message)
    router.refresh()
  }

  const submitDependent = () => {
    if (!dependentForm.firstName.trim() || !dependentForm.lastName.trim() || !dependentForm.relationshipId) {
      toast.error("First name, last name, and relationship are required.")
      return
    }

    startTransition(async () => {
      const payload = {
        companyId,
        employeeId: employee.id,
        firstName: dependentForm.firstName,
        middleName: dependentForm.middleName,
        lastName: dependentForm.lastName,
        relationshipId: dependentForm.relationshipId as Parameters<typeof createDependentAction>[0]["relationshipId"],
        birthDate: dependentForm.birthDate,
        isTaxDependent: dependentForm.isTaxDependent,
      }

      const result = dependentForm.dependentId
        ? await updateDependentAction({ ...payload, dependentId: dependentForm.dependentId })
        : await createDependentAction(payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDependentDialogOpen(false)
      setDependentForm(emptyDependentForm())
      refreshWithSuccess(result.message)
    })
  }

  const submitBeneficiary = () => {
    const percentage = Number(beneficiaryForm.percentage)
    if (!beneficiaryForm.name.trim() || !beneficiaryForm.relationshipId || Number.isNaN(percentage)) {
      toast.error("Name, relationship, and valid percentage are required.")
      return
    }

    startTransition(async () => {
      const payload = {
        companyId,
        employeeId: employee.id,
        name: beneficiaryForm.name,
        relationshipId: beneficiaryForm.relationshipId as Parameters<typeof createBeneficiaryAction>[0]["relationshipId"],
        percentage,
        contactNumber: beneficiaryForm.contactNumber,
      }

      const result = beneficiaryForm.beneficiaryId
        ? await updateBeneficiaryAction({ ...payload, beneficiaryId: beneficiaryForm.beneficiaryId })
        : await createBeneficiaryAction(payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setBeneficiaryDialogOpen(false)
      setBeneficiaryForm(emptyBeneficiaryForm())
      refreshWithSuccess(result.message)
    })
  }

  const submitEducation = () => {
    const yearGraduated = educationForm.yearGraduated.trim().length > 0 ? Number(educationForm.yearGraduated) : undefined
    if (!educationForm.educationLevelId || !educationForm.schoolName.trim()) {
      toast.error("Education level and school name are required.")
      return
    }
    if (yearGraduated !== undefined && (Number.isNaN(yearGraduated) || !Number.isInteger(yearGraduated))) {
      toast.error("Year graduated must be a valid year.")
      return
    }

    startTransition(async () => {
      const payload = {
        companyId,
        employeeId: employee.id,
        educationLevelId: educationForm.educationLevelId as Parameters<typeof createEducationAction>[0]["educationLevelId"],
        schoolName: educationForm.schoolName,
        course: educationForm.course,
        yearGraduated,
      }

      const result = educationForm.educationId
        ? await updateEducationAction({ ...payload, educationId: educationForm.educationId })
        : await createEducationAction(payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setEducationDialogOpen(false)
      setEducationForm(emptyEducationForm())
      refreshWithSuccess(result.message)
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return

    startTransition(async () => {
      const result =
        deleteTarget.kind === "dependent"
          ? await deleteDependentAction({ companyId, employeeId: employee.id, dependentId: deleteTarget.id })
          : deleteTarget.kind === "beneficiary"
            ? await deleteBeneficiaryAction({ companyId, employeeId: employee.id, beneficiaryId: deleteTarget.id })
            : await deleteEducationAction({ companyId, employeeId: employee.id, educationId: deleteTarget.id })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDeleteTarget(null)
      refreshWithSuccess(result.message)
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Dependents"
          number="01"
          icon={IconUsers}
          action={<Button size="sm" onClick={() => { setDependentForm(emptyDependentForm()); setDependentDialogOpen(true) }}><IconPlus className="size-4" /> Add Dependent</Button>}
        />
        <Table
          headers={["Name", "Relationship", "Birth Date", "Tax Dependent", "Actions"]}
          rows={employee.dependents.map((row) => [
            row.name,
            row.relationship,
            row.birthDate,
            row.taxDependent,
            <RowActions
              key={row.id}
              onEdit={() => {
                setDependentForm({
                  dependentId: row.id,
                  firstName: row.firstName,
                  middleName: row.middleName,
                  lastName: row.lastName,
                  relationshipId: row.relationshipId,
                  birthDate: row.birthDateValue,
                  isTaxDependent: row.isTaxDependent,
                })
                setDependentDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget({ kind: "dependent", id: row.id })}
            />,
          ])}
        />
      </div>

      <div>
        <SectionHeader
          title="Beneficiaries"
          number="02"
          icon={IconUsers}
          action={<Button size="sm" onClick={() => { setBeneficiaryForm(emptyBeneficiaryForm()); setBeneficiaryDialogOpen(true) }}><IconPlus className="size-4" /> Add Beneficiary</Button>}
        />
        <Table
          headers={["Name", "Relationship", "Percentage", "Contact", "Actions"]}
          rows={employee.beneficiaries.map((row) => [
            row.name,
            row.relationship,
            row.percentage,
            row.contact,
            <RowActions
              key={row.id}
              onEdit={() => {
                setBeneficiaryForm({
                  beneficiaryId: row.id,
                  name: row.name,
                  relationshipId: row.relationshipId,
                  percentage: row.percentageValue.toString(),
                  contactNumber: row.contact === "-" ? "" : row.contact,
                })
                setBeneficiaryDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget({ kind: "beneficiary", id: row.id })}
            />,
          ])}
        />
      </div>

      <div>
        <SectionHeader
          title="Education"
          number="03"
          icon={IconUsers}
          action={<Button size="sm" onClick={() => { setEducationForm(emptyEducationForm()); setEducationDialogOpen(true) }}><IconPlus className="size-4" /> Add Education</Button>}
        />
        <Table
          headers={["Level", "School", "Course", "Year Graduated", "Actions"]}
          rows={employee.educations.map((row) => [
            row.level,
            row.school,
            row.course,
            row.yearGraduated,
            <RowActions
              key={row.id}
              onEdit={() => {
                setEducationForm({
                  educationId: row.id,
                  educationLevelId: row.educationLevelId,
                  schoolName: row.school,
                  course: row.course === "-" ? "" : row.course,
                  yearGraduated: row.yearGraduatedValue ? String(row.yearGraduatedValue) : "",
                })
                setEducationDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget({ kind: "education", id: row.id })}
            />,
          ])}
        />
      </div>

      <Dialog open={dependentDialogOpen} onOpenChange={setDependentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dependentForm.dependentId ? "Edit Dependent" : "Add Dependent"}</DialogTitle>
            <DialogDescription>Manage dependent records with company-scoped validation and audit logs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><RequiredLabel label="First Name" /><Input value={dependentForm.firstName} onChange={(event) => setDependentForm((prev) => ({ ...prev, firstName: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Middle Name</Label><Input value={dependentForm.middleName} onChange={(event) => setDependentForm((prev) => ({ ...prev, middleName: event.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><RequiredLabel label="Last Name" /><Input value={dependentForm.lastName} onChange={(event) => setDependentForm((prev) => ({ ...prev, lastName: event.target.value }))} /></div>
              <div className="space-y-1.5">
                <RequiredLabel label="Relationship" />
                <Select value={dependentForm.relationshipId} onValueChange={(value) => setDependentForm((prev) => ({ ...prev, relationshipId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                  <SelectContent>{options.relationshipTypes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DateField label="Birth Date" value={dependentForm.birthDate} onChange={(value) => setDependentForm((prev) => ({ ...prev, birthDate: value }))} />
              <div className="space-y-1.5">
                <Label>Tax Dependent</Label>
                <div className="flex h-10 items-center rounded-md border border-input px-3">
                  <Checkbox checked={dependentForm.isTaxDependent} onCheckedChange={(checked) => setDependentForm((prev) => ({ ...prev, isTaxDependent: checked === true }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDependentDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitDependent} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={beneficiaryDialogOpen} onOpenChange={setBeneficiaryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{beneficiaryForm.beneficiaryId ? "Edit Beneficiary" : "Add Beneficiary"}</DialogTitle>
            <DialogDescription>Maintain beneficiary allocation and relationship details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><RequiredLabel label="Name" /><Input value={beneficiaryForm.name} onChange={(event) => setBeneficiaryForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div className="space-y-1.5">
                <RequiredLabel label="Relationship" />
                <Select value={beneficiaryForm.relationshipId} onValueChange={(value) => setBeneficiaryForm((prev) => ({ ...prev, relationshipId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                  <SelectContent>{options.relationshipTypes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><RequiredLabel label="Percentage" /><Input inputMode="decimal" value={beneficiaryForm.percentage} onChange={(event) => setBeneficiaryForm((prev) => ({ ...prev, percentage: event.target.value }))} placeholder="e.g. 50" /></div>
              <div className="space-y-1.5"><Label>Contact Number</Label><Input value={beneficiaryForm.contactNumber} onChange={(event) => setBeneficiaryForm((prev) => ({ ...prev, contactNumber: event.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBeneficiaryDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitBeneficiary} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={educationDialogOpen} onOpenChange={setEducationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{educationForm.educationId ? "Edit Education" : "Add Education"}</DialogTitle>
            <DialogDescription>Keep education records complete and editable from the profile tab.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <RequiredLabel label="Education Level" />
                <Select value={educationForm.educationLevelId} onValueChange={(value) => setEducationForm((prev) => ({ ...prev, educationLevelId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>{options.educationLevels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><RequiredLabel label="School Name" /><Input value={educationForm.schoolName} onChange={(event) => setEducationForm((prev) => ({ ...prev, schoolName: event.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label>Course</Label><Input value={educationForm.course} onChange={(event) => setEducationForm((prev) => ({ ...prev, course: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Year Graduated</Label><Input inputMode="numeric" value={educationForm.yearGraduated} onChange={(event) => setEducationForm((prev) => ({ ...prev, yearGraduated: event.target.value }))} placeholder="e.g. 2022" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEducationDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitEducation} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the selected row from the employee&apos;s active records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | ReactNode>> }) {
  if (rows.length === 0) return <Empty />

  return (
    <div className="overflow-x-auto border border-border/60">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-2 text-left font-medium">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`} className="border-t border-border/60">
              {row.map((cell, idx) => <td key={`cell-${index}-${idx}`} className="px-3 py-2 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onEdit}><IconEdit className="size-3.5" /> Edit</Button>
      <Button type="button" variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive"><IconTrash className="size-3.5" /> Delete</Button>
    </div>
  )
}
