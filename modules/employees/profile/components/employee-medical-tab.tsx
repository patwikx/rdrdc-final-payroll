"use client"

import { useRef, useState, useTransition } from "react"
import type { ComponentType, ReactNode } from "react"
import { IconCalendarEvent, IconDownload, IconEdit, IconFileUpload, IconHeart, IconPlus, IconTrash, IconX } from "@tabler/icons-react"
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
import { Textarea } from "@/components/ui/textarea"
import { getPhYear, parsePhDateInputToPhDate, toPhDateInputValue } from "@/lib/ph-time"
import {
  createMedicalAttachmentUploadUrlAction,
  createMedicalRecordAction,
  deleteMedicalAttachmentAction,
  deleteMedicalRecordAction,
  finalizeMedicalAttachmentAction,
  updateMedicalRecordAction,
} from "@/modules/employees/profile/actions/medical-crud-actions"
import type { EmployeeProfileViewModel } from "@/modules/employees/profile/utils/get-employee-profile-data"

type EmployeeData = EmployeeProfileViewModel["employee"]

type MedicalRecordForm = {
  medicalRecordId: string | null
  examYear: string
  examDate: string
  examType: string
  clinicName: string
  physician: string
  result: string
  findings: string
  remarks: string
  uploadDescription: string
}

type DeleteTarget =
  | { kind: "record"; id: string }
  | { kind: "attachment"; id: string }

const emptyMedicalRecordForm = (): MedicalRecordForm => ({
  medicalRecordId: null,
  examYear: "",
  examDate: "",
  examType: "APE",
  clinicName: "",
  physician: "",
  result: "",
  findings: "",
  remarks: "",
  uploadDescription: "",
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

function DateField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {required ? <RequiredLabel label={label} /> : <Label>{label}</Label>}
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

export function EmployeeMedicalTab({ companyId, employee }: { companyId: string; employee: EmployeeData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  const [medicalDialogOpen, setMedicalDialogOpen] = useState(false)
  const [medicalForm, setMedicalForm] = useState<MedicalRecordForm>(emptyMedicalRecordForm())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const refreshWithSuccess = (message: string) => {
    toast.success(message)
    router.refresh()
  }

  const uploadAttachmentForRecord = async (medicalRecordId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!selectedFile) return { ok: true }

    const uploadMeta = await createMedicalAttachmentUploadUrlAction({
      companyId,
      employeeId: employee.id,
      medicalRecordId,
      fileName: selectedFile.name,
      fileType: selectedFile.type || "application/octet-stream",
      fileSize: selectedFile.size,
      description: medicalForm.uploadDescription,
    })

    if (!uploadMeta.ok) return { ok: false, error: uploadMeta.error }

    const uploadResponse = await fetch(uploadMeta.uploadUrl, {
      method: "PUT",
      headers: uploadMeta.requiredHeaders,
      body: selectedFile,
    })

    if (!uploadResponse.ok) {
      return { ok: false, error: "Upload failed. Please try again." }
    }

    const result = await finalizeMedicalAttachmentAction({
      companyId,
      employeeId: employee.id,
      medicalRecordId,
      fileName: selectedFile.name,
      fileType: selectedFile.type || "application/octet-stream",
      fileSize: selectedFile.size,
      description: medicalForm.uploadDescription,
      objectKey: uploadMeta.objectKey,
    })

    return result.ok ? { ok: true } : { ok: false, error: result.error }
  }

  const submitMedicalRecord = () => {
    const examYear = Number(medicalForm.examYear)
    if (!medicalForm.examDate || !medicalForm.examType.trim() || Number.isNaN(examYear)) {
      toast.error("Exam year, exam date, and exam type are required.")
      return
    }

    startTransition(async () => {
      const payload = {
        companyId,
        employeeId: employee.id,
        examYear,
        examDate: medicalForm.examDate,
        examType: medicalForm.examType,
        clinicName: medicalForm.clinicName,
        physician: medicalForm.physician,
        findings: medicalForm.findings,
        remarks: medicalForm.remarks,
        result: medicalForm.result,
      }

      const recordResult = medicalForm.medicalRecordId
        ? await updateMedicalRecordAction({ ...payload, medicalRecordId: medicalForm.medicalRecordId })
        : await createMedicalRecordAction(payload)

      if (!recordResult.ok) {
        toast.error(recordResult.error)
        return
      }

      const uploadResult = await uploadAttachmentForRecord(recordResult.medicalRecordId)
      if (!uploadResult.ok) {
        toast.error(`${recordResult.message} Attachment upload failed: ${uploadResult.error}`)
        setMedicalDialogOpen(false)
        setMedicalForm(emptyMedicalRecordForm())
        setSelectedFile(null)
        refreshWithSuccess("Medical record saved.")
        return
      }

      setMedicalDialogOpen(false)
      setMedicalForm(emptyMedicalRecordForm())
      setSelectedFile(null)
      refreshWithSuccess(selectedFile ? `${recordResult.message} Attachment uploaded.` : recordResult.message)
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return

    startTransition(async () => {
      const result =
        deleteTarget.kind === "record"
          ? await deleteMedicalRecordAction({ companyId, employeeId: employee.id, medicalRecordId: deleteTarget.id })
          : await deleteMedicalAttachmentAction({ companyId, employeeId: employee.id, attachmentId: deleteTarget.id })

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
          title="Annual Physical Examination"
          number="01"
          icon={IconHeart}
          action={
            <Button
              size="sm"
              onClick={() => {
                const nowYear = getPhYear()
                setMedicalForm({ ...emptyMedicalRecordForm(), examYear: String(nowYear) })
                setSelectedFile(null)
                setMedicalDialogOpen(true)
              }}
            >
              <IconPlus className="size-4" /> Add APE Record
            </Button>
          }
        />

        {employee.medicalRecords.length === 0 ? (
          <Empty message="No annual physical exam records yet." />
        ) : (
          <div className="space-y-4">
            {employee.medicalRecords.map((record) => (
              <div key={record.id} className="border border-border/60 p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">APE {record.examYear} • {record.examDate}</p>
                    <p className="text-xs text-muted-foreground">{record.examType} • {record.result}</p>
                    <p className="text-xs text-muted-foreground">{record.clinicName} • {record.physician}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      setMedicalForm({
                        medicalRecordId: record.id,
                        examYear: String(record.examYearValue),
                        examDate: record.examDateValue,
                        examType: record.examType,
                        clinicName: record.clinicNameValue,
                        physician: record.physicianValue,
                        result: record.resultValue,
                        findings: record.findingsValue,
                        remarks: record.remarksValue,
                        uploadDescription: "",
                      })
                      setSelectedFile(null)
                      setMedicalDialogOpen(true)
                    }}>
                      <IconEdit className="size-3.5" /> Edit
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ kind: "record", id: record.id })}>
                      <IconTrash className="size-3.5" /> Delete
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Findings</p>
                    <p className="text-sm text-foreground">{record.findings}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Remarks</p>
                    <p className="text-sm text-foreground">{record.remarks}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Attachments</p>
                  {record.attachments.length === 0 ? (
                    <Empty message="No attachments uploaded for this APE record." />
                  ) : (
                    <div className="overflow-x-auto border border-border/60">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/30 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">File</th>
                            <th className="px-3 py-2 text-left font-medium">Type</th>
                            <th className="px-3 py-2 text-left font-medium">Size</th>
                            <th className="px-3 py-2 text-left font-medium">Description</th>
                            <th className="px-3 py-2 text-left font-medium">Uploaded</th>
                            <th className="px-3 py-2 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {record.attachments.map((attachment) => (
                            <tr key={attachment.id} className="border-t border-border/60">
                              <td className="px-3 py-2">{attachment.fileName}</td>
                              <td className="px-3 py-2 text-muted-foreground">{attachment.fileType}</td>
                              <td className="px-3 py-2 text-muted-foreground">{attachment.fileSize}</td>
                              <td className="px-3 py-2 text-muted-foreground">{attachment.description}</td>
                              <td className="px-3 py-2 text-muted-foreground">{attachment.uploadedAt}</td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-2">
                                  <a href={`/${companyId}/employees/${employee.id}/medical/attachments/${attachment.id}/download`} className="inline-flex">
                                    <Button type="button" variant="outline" size="sm">
                                      <IconDownload className="size-3.5" /> Download
                                    </Button>
                                  </a>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setDeleteTarget({ kind: "attachment", id: attachment.id })}
                                  >
                                    <IconTrash className="size-3.5" /> Delete
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader title="Emergency Contacts" number="02" icon={IconHeart} />
        {employee.emergencyContacts.length === 0 ? (
          <Empty message="No emergency contacts listed." />
        ) : (
          <div className="space-y-2">
            {employee.emergencyContacts.map((row) => (
              <div key={`${row.name}-${row.relationship}-${row.priority}`} className="border border-border/60 p-3">
                <p className="text-sm font-semibold text-foreground">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.relationship} • Priority {row.priority}</p>
                <p className="text-xs text-muted-foreground">{row.mobile} • {row.email}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={medicalDialogOpen} onOpenChange={setMedicalDialogOpen}>
        <DialogContent className="sm:max-w-2xl [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>{medicalForm.medicalRecordId ? "Edit Annual Physical Exam" : "Add Annual Physical Exam"}</DialogTitle>
            <DialogDescription>Track annual physical exam details and securely upload supporting documents in one dialog.</DialogDescription>
          </DialogHeader>

          <div className="grid min-w-0 gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <RequiredLabel label="Exam Year" />
                <Input inputMode="numeric" value={medicalForm.examYear} onChange={(event) => setMedicalForm((prev) => ({ ...prev, examYear: event.target.value }))} placeholder="e.g. 2026" />
              </div>
              <DateField label="Exam Date" value={medicalForm.examDate} onChange={(value) => setMedicalForm((prev) => ({ ...prev, examDate: value }))} required />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <RequiredLabel label="Exam Type" />
                <Input value={medicalForm.examType} onChange={(event) => setMedicalForm((prev) => ({ ...prev, examType: event.target.value }))} placeholder="APE" />
              </div>
              <div className="space-y-1.5">
                <Label>Result</Label>
                <Select value={medicalForm.result || "__none__"} onValueChange={(value) => setMedicalForm((prev) => ({ ...prev, result: value === "__none__" ? "" : value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select result" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    <SelectItem value="FIT">FIT</SelectItem>
                    <SelectItem value="UNFIT">UNFIT</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Clinic Name</Label>
                <Input value={medicalForm.clinicName} onChange={(event) => setMedicalForm((prev) => ({ ...prev, clinicName: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Physician</Label>
                <Input value={medicalForm.physician} onChange={(event) => setMedicalForm((prev) => ({ ...prev, physician: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Findings</Label>
                <Textarea value={medicalForm.findings} onChange={(event) => setMedicalForm((prev) => ({ ...prev, findings: event.target.value }))} rows={4} />
              </div>

              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Textarea value={medicalForm.remarks} onChange={(event) => setMedicalForm((prev) => ({ ...prev, remarks: event.target.value }))} rows={4} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Upload Attachment (Optional)</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP up to 20MB. Stored in private bucket.</p>
              </div>

              <div className="relative w-full max-w-full min-w-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex h-10 w-full max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border border-dashed border-primary/40 bg-background px-3 pr-10 text-sm font-medium text-foreground transition-colors hover:bg-primary/5"
                >
                  <IconFileUpload className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">{selectedFile ? selectedFile.name : "Select File"}</span>
                </button>
                {selectedFile ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 z-10 size-8 -translate-y-1/2"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedFile(null)
                      if (uploadInputRef.current) {
                        uploadInputRef.current.value = ""
                      }
                    }}
                    aria-label="Clear selected file"
                  >
                    <IconX className="size-4" />
                  </Button>
                ) : null}
              </div>

              <Input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0]
                  if (nextFile) {
                    setSelectedFile(nextFile)
                  }
                }}
              />
              <div className="space-y-1.5">
                <Label>Attachment Description</Label>
                <Input value={medicalForm.uploadDescription} onChange={(event) => setMedicalForm((prev) => ({ ...prev, uploadDescription: event.target.value }))} placeholder="e.g. Lab Results" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMedicalDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={submitMedicalRecord} disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected item from active medical records.
            </AlertDialogDescription>
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
