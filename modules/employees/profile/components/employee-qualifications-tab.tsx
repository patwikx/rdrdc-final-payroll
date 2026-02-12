"use client"

import { useState, useTransition } from "react"
import type { ComponentType, ReactNode } from "react"
import { IconAward, IconCalendarEvent, IconEdit, IconPlus, IconSchool, IconTrash } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  createEducationAction,
  deleteEducationAction,
  updateEducationAction,
} from "@/modules/employees/profile/actions/education-family-crud-actions"
import {
  createTrainingAction,
  deleteTrainingAction,
  updateTrainingAction,
} from "@/modules/employees/profile/actions/training-crud-actions"
import type { EmployeeProfileViewModel } from "@/modules/employees/profile/utils/get-employee-profile-data"

type EmployeeData = EmployeeProfileViewModel["employee"]
type OptionsData = EmployeeProfileViewModel["options"]

type EducationForm = {
  educationId: string | null
  educationLevelId: string
  schoolName: string
  course: string
  yearGraduated: string
}

type TrainingForm = {
  trainingId: string | null
  trainingName: string
  provider: string
  trainingDate: string
  trainingEndDate: string
  durationHours: string
  location: string
}

const emptyEducationForm = (): EducationForm => ({
  educationId: null,
  educationLevelId: "",
  schoolName: "",
  course: "",
  yearGraduated: "",
})

const emptyTrainingForm = (): TrainingForm => ({
  trainingId: null,
  trainingName: "",
  provider: "",
  trainingDate: "",
  trainingEndDate: "",
  durationHours: "",
  location: "",
})

const toDateInputValue = (date: Date | undefined): string => {
  if (!date) return ""
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date)
}

const toDateLabel = (value: string): string => {
  const date = new Date(`${value}T00:00:00+08:00`)
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date)
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span>{value ? toDateLabel(value) : "Select date"}</span>
            <IconCalendarEvent className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(`${value}T00:00:00+08:00`) : undefined}
            onSelect={(date) => onChange(toDateInputValue(date))}
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

function RowCard({ title, subtitle, meta }: { title: string; subtitle: string; meta: string }) {
  return (
    <div className="border border-border/60 p-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
    </div>
  )
}

export function EmployeeQualificationsTab({ companyId, employee, options }: { companyId: string; employee: EmployeeData; options: OptionsData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [educationDialogOpen, setEducationDialogOpen] = useState(false)
  const [educationForm, setEducationForm] = useState<EducationForm>(emptyEducationForm())
  const [deleteEducationId, setDeleteEducationId] = useState<string | null>(null)
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false)
  const [trainingForm, setTrainingForm] = useState<TrainingForm>(emptyTrainingForm())
  const [deleteTrainingId, setDeleteTrainingId] = useState<string | null>(null)

  const refreshWithSuccess = (message: string) => {
    toast.success(message)
    router.refresh()
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

  const confirmDeleteEducation = () => {
    if (!deleteEducationId) return

    startTransition(async () => {
      const result = await deleteEducationAction({ companyId, employeeId: employee.id, educationId: deleteEducationId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDeleteEducationId(null)
      refreshWithSuccess(result.message)
    })
  }

  const submitTraining = () => {
    const durationHours = trainingForm.durationHours.trim().length > 0 ? Number(trainingForm.durationHours) : undefined
    if (!trainingForm.trainingName.trim()) {
      toast.error("Training name is required.")
      return
    }
    if (durationHours !== undefined && (Number.isNaN(durationHours) || durationHours < 0)) {
      toast.error("Duration hours must be a valid non-negative number.")
      return
    }

    startTransition(async () => {
      const payload = {
        companyId,
        employeeId: employee.id,
        trainingName: trainingForm.trainingName,
        provider: trainingForm.provider,
        trainingDate: trainingForm.trainingDate,
        trainingEndDate: trainingForm.trainingEndDate,
        durationHours,
        location: trainingForm.location,
      }

      const result = trainingForm.trainingId
        ? await updateTrainingAction({ ...payload, trainingId: trainingForm.trainingId })
        : await createTrainingAction(payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setTrainingDialogOpen(false)
      setTrainingForm(emptyTrainingForm())
      refreshWithSuccess(result.message)
    })
  }

  const confirmDeleteTraining = () => {
    if (!deleteTrainingId) return

    startTransition(async () => {
      const result = await deleteTrainingAction({ companyId, employeeId: employee.id, trainingId: deleteTrainingId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDeleteTrainingId(null)
      refreshWithSuccess(result.message)
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Education"
          number="01"
          icon={IconSchool}
          action={<Button size="sm" onClick={() => { setEducationForm(emptyEducationForm()); setEducationDialogOpen(true) }}><IconPlus className="size-4" /> Add Education</Button>}
        />
        <Table
          headers={["Level", "School", "Course", "Year Graduated", "Actions"]}
          rows={employee.educations.map((row) => [
            row.level,
            row.school,
            row.course,
            row.yearGraduated,
            <div key={row.id} className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => {
                setEducationForm({
                  educationId: row.id,
                  educationLevelId: row.educationLevelId,
                  schoolName: row.school,
                  course: row.course === "-" ? "" : row.course,
                  yearGraduated: row.yearGraduatedValue ? String(row.yearGraduatedValue) : "",
                })
                setEducationDialogOpen(true)
              }}><IconEdit className="size-3.5" /> Edit</Button>
              <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteEducationId(row.id)}><IconTrash className="size-3.5" /> Delete</Button>
            </div>,
          ])}
        />
      </div>

      <div>
        <SectionHeader
          title="Trainings"
          number="02"
          icon={IconAward}
          action={<Button size="sm" onClick={() => { setTrainingForm(emptyTrainingForm()); setTrainingDialogOpen(true) }}><IconPlus className="size-4" /> Add Training</Button>}
        />
        <Table
          headers={["Training", "Provider", "Start", "End", "Hours", "Location", "Actions"]}
          rows={employee.trainings.map((row) => [
            row.trainingName,
            row.provider,
            row.trainingDate,
            row.trainingEndDate,
            row.durationHours,
            row.location,
            <div key={row.id} className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => {
                setTrainingForm({
                  trainingId: row.id,
                  trainingName: row.trainingName,
                  provider: row.providerValue,
                  trainingDate: row.trainingDateValue,
                  trainingEndDate: row.trainingEndDateValue,
                  durationHours: row.durationHoursValue !== null ? String(row.durationHoursValue) : "",
                  location: row.locationValue,
                })
                setTrainingDialogOpen(true)
              }}><IconEdit className="size-3.5" /> Edit</Button>
              <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTrainingId(row.id)}><IconTrash className="size-3.5" /> Delete</Button>
            </div>,
          ])}
        />
      </div>

      <div>
        <SectionHeader title="Other Qualifications" number="03" icon={IconAward} />
        {employee.qualifications.length === 0 ? <Empty /> : employee.qualifications.map((row) => <RowCard key={`${row.category}-${row.name}-${row.dateLabel}`} title={`${row.category}: ${row.name}`} subtitle={row.details} meta={row.dateLabel} />)}
      </div>

      <Dialog open={educationDialogOpen} onOpenChange={setEducationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{educationForm.educationId ? "Edit Education" : "Add Education"}</DialogTitle>
            <DialogDescription>Keep education records complete and editable from the Qualifications tab.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Education Level <span className="text-destructive">*</span></Label>
                <Select value={educationForm.educationLevelId} onValueChange={(value) => setEducationForm((prev) => ({ ...prev, educationLevelId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>{options.educationLevels.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>School Name <span className="text-destructive">*</span></Label><Input value={educationForm.schoolName} onChange={(event) => setEducationForm((prev) => ({ ...prev, schoolName: event.target.value }))} /></div>
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

      <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{trainingForm.trainingId ? "Edit Training" : "Add Training"}</DialogTitle>
            <DialogDescription>Manage employee training records from the Qualifications tab.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label>Training Name <span className="text-destructive">*</span></Label><Input value={trainingForm.trainingName} onChange={(event) => setTrainingForm((prev) => ({ ...prev, trainingName: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Provider</Label><Input value={trainingForm.provider} onChange={(event) => setTrainingForm((prev) => ({ ...prev, provider: event.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DateField label="Start Date" value={trainingForm.trainingDate} onChange={(value) => setTrainingForm((prev) => ({ ...prev, trainingDate: value }))} />
              <DateField label="End Date" value={trainingForm.trainingEndDate} onChange={(value) => setTrainingForm((prev) => ({ ...prev, trainingEndDate: value }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label>Duration Hours</Label><Input inputMode="decimal" value={trainingForm.durationHours} onChange={(event) => setTrainingForm((prev) => ({ ...prev, durationHours: event.target.value }))} placeholder="e.g. 8" /></div>
              <div className="space-y-1.5"><Label>Location</Label><Input value={trainingForm.location} onChange={(event) => setTrainingForm((prev) => ({ ...prev, location: event.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrainingDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitTraining} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteEducationId)} onOpenChange={(open) => { if (!open) setDeleteEducationId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Education Record?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the selected education row from active records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEducation} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteTrainingId)} onOpenChange={(open) => { if (!open) setDeleteTrainingId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Record?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the selected training row from active records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTraining} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
