"use client"

import type { ChangeEvent } from "react"
import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconBriefcase,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IconId,
  IconPhoto,
  IconPlus,
  IconUserPlus,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { AnimatePresence, motion } from "framer-motion"
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
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createOnboardingSelectEntityAction } from "@/modules/employees/onboarding/actions/create-onboarding-select-entity-action"
import { createEmployeeOnboardingAction } from "@/modules/employees/onboarding/actions/create-employee-onboarding-action"
import {
  civilStatusOptions,
  documentTypeOptions,
  genderOptions,
  relationshipOptions,
  taxStatusOptions,
  type EmployeeOnboardingInput,
} from "@/modules/employees/onboarding/schemas/employee-onboarding-schema"

type Option = { id: string; code: string; name: string }

type EmployeeOnboardingPageProps = {
  companyName: string
  initialData: EmployeeOnboardingInput
  options: {
    employmentStatuses: Option[]
    employmentTypes: Option[]
    employmentClasses: Option[]
    departments: Option[]
    divisions: Option[]
    positions: Option[]
    ranks: Option[]
    branches: Option[]
    managers: Option[]
    workSchedules: Option[]
    payPeriodPatterns: Option[]
    genders: Array<{ id: (typeof genderOptions)[number]; name: string }>
    civilStatuses: Array<{ id: (typeof civilStatusOptions)[number]; name: string }>
    relationships: Array<{ id: (typeof relationshipOptions)[number]; name: string }>
    taxStatuses: Array<{ id: (typeof taxStatusOptions)[number]; name: string }>
  }
}

type StepKey = "stepOne" | "stepTwo"
type DynamicOptionKey =
  | "employmentStatuses"
  | "employmentTypes"
  | "employmentClasses"
  | "departments"
  | "divisions"
  | "positions"
  | "ranks"
  | "branches"

type DynamicCreateEntity =
  | "employmentStatus"
  | "employmentType"
  | "employmentClass"
  | "department"
  | "division"
  | "position"
  | "rank"
  | "branch"

type EmploymentFieldKey =
  | "employmentStatusId"
  | "employmentTypeId"
  | "employmentClassId"
  | "departmentId"
  | "divisionId"
  | "positionId"
  | "rankId"
  | "branchId"

type DynamicCreateTarget = {
  key: DynamicOptionKey
  entity: DynamicCreateEntity
  label: string
  employmentField: EmploymentFieldKey
}

const dynamicSelectTargets: Record<DynamicOptionKey, DynamicCreateTarget> = {
  employmentStatuses: {
    key: "employmentStatuses",
    entity: "employmentStatus",
    label: "Employment Status",
    employmentField: "employmentStatusId",
  },
  employmentTypes: {
    key: "employmentTypes",
    entity: "employmentType",
    label: "Employment Type",
    employmentField: "employmentTypeId",
  },
  employmentClasses: {
    key: "employmentClasses",
    entity: "employmentClass",
    label: "Employment Class",
    employmentField: "employmentClassId",
  },
  departments: {
    key: "departments",
    entity: "department",
    label: "Department",
    employmentField: "departmentId",
  },
  divisions: {
    key: "divisions",
    entity: "division",
    label: "Division",
    employmentField: "divisionId",
  },
  positions: {
    key: "positions",
    entity: "position",
    label: "Position",
    employmentField: "positionId",
  },
  ranks: {
    key: "ranks",
    entity: "rank",
    label: "Rank",
    employmentField: "rankId",
  },
  branches: {
    key: "branches",
    entity: "branch",
    label: "Branch",
    employmentField: "branchId",
  },
}

const Required = () => <span className="ml-1 text-destructive">*</span>

const formatDisplayDate = (value: string): string => {
  if (!value) return ""
  const parsed = new Date(`${value}T00:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) return ""

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const toPhDateInputValue = (date: Date | undefined): string => {
  if (!date) return ""
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date)
}

const computeDailyRate = (monthlyRate: number, monthlyDivisor: number): number => {
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0) {
    return 0
  }

  if (!Number.isFinite(monthlyDivisor) || monthlyDivisor <= 0) {
    return 0
  }

  return (monthlyRate * 12) / monthlyDivisor
}

const computeHourlyRate = (dailyRate: number, hoursPerDay: number): number => {
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    return 0
  }

  if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) {
    return 0
  }

  return dailyRate / hoursPerDay
}

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read file."))
    reader.readAsDataURL(file)
  })
}

export function EmployeeOnboardingPage({ companyName, initialData, options }: EmployeeOnboardingPageProps) {
  const router = useRouter()
  const [form, setForm] = useState<EmployeeOnboardingInput>(initialData)
  const [dynamicOptions, setDynamicOptions] = useState(options)
  const [step, setStep] = useState<StepKey>("stepOne")
  const [isPending, startTransition] = useTransition()
  const [isCreatingOption, startCreateOption] = useTransition()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [createTarget, setCreateTarget] = useState<DynamicCreateTarget | null>(null)
  const [createName, setCreateName] = useState("")
  const profileInputRef = useRef<HTMLInputElement | null>(null)
  const documentsInputRef = useRef<HTMLInputElement | null>(null)

  const updateSection = <S extends keyof EmployeeOnboardingInput, K extends keyof EmployeeOnboardingInput[S]>(
    section: S,
    key: K,
    value: EmployeeOnboardingInput[S][K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as Record<string, unknown>),
        [key]: value,
      },
    }))
  }

  const completion = useMemo(() => {
    const stepOneComplete = Boolean(
      form.identity.employeeNumber &&
        form.identity.firstName &&
        form.identity.lastName &&
        form.identity.birthDate &&
        form.contact.mobileNumber &&
        form.contact.personalEmail
    )
    const stepTwoComplete = Boolean(
      form.employment.hireDate &&
        form.employment.employmentStatusId &&
        form.employment.employmentTypeId &&
        form.employment.employmentClassId &&
        form.employment.departmentId &&
        form.employment.positionId &&
        form.payroll.monthlyRate > 0 &&
        form.payroll.workScheduleId &&
        form.payroll.payPeriodPatternId &&
        form.tax.taxStatusId
    )

    const score = Math.round(([stepOneComplete, stepTwoComplete].filter(Boolean).length / 2) * 100)
    return { stepOneComplete, stepTwoComplete, score }
  }, [form])

  const employeeDisplayName = useMemo(() => {
    const first = form.identity.firstName.trim()
    const last = form.identity.lastName.trim()
    const suffix = (form.identity.suffix ?? "").trim()

    const base = [first, last].filter((part) => part.length > 0).join(" ")
    return [base, suffix].filter((part) => part.length > 0).join(" ") || "this employee"
  }, [form.identity.firstName, form.identity.lastName, form.identity.suffix])

  const dailyRatePreview = useMemo(() => {
    const value = computeDailyRate(form.payroll.monthlyRate, form.payroll.monthlyDivisor)
    return value > 0 ? value.toFixed(2) : ""
  }, [form.payroll.monthlyRate, form.payroll.monthlyDivisor])

  const hourlyRatePreview = useMemo(() => {
    const dailyRate = computeDailyRate(form.payroll.monthlyRate, form.payroll.monthlyDivisor)
    const value = computeHourlyRate(dailyRate, form.payroll.hoursPerDay)
    return value > 0 ? value.toFixed(2) : ""
  }, [form.payroll.monthlyRate, form.payroll.monthlyDivisor, form.payroll.hoursPerDay])

  const handleProfilePhotoFile = async (file: File | undefined) => {
    if (!file) return

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setForm((prev) => ({
        ...prev,
        uploads: {
          ...prev.uploads,
          profilePhotoDataUrl: dataUrl,
          profilePhotoFileName: file.name,
        },
      }))
      toast.success("Profile image attached.")
    } catch {
      toast.error("Failed to read selected profile image.")
    }
  }

  const handleDocumentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    try {
      const loaded = await Promise.all(
        Array.from(files).map(async (file) => ({
          title: file.name,
          documentTypeId: "OTHER" as const,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          fileDataUrl: await readFileAsDataUrl(file),
        }))
      )

      setForm((prev) => ({
        ...prev,
        uploads: {
          ...prev.uploads,
          scannedDocuments: [...prev.uploads.scannedDocuments, ...loaded].slice(0, 10),
        },
      }))

      toast.success(`${loaded.length} scanned document(s) attached.`)
    } catch {
      toast.error("Failed to read one or more uploaded documents.")
    }
  }

  const handleSubmit = () => {
    setIsConfirmOpen(false)

    startTransition(async () => {
      const result = await createEmployeeOnboardingAction(form)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setForm(initialData)
      setStep("stepOne")
      router.refresh()
    })
  }

  const openCreateDialog = (key: DynamicOptionKey) => {
    setCreateTarget(dynamicSelectTargets[key])
    setCreateName("")
  }

  const handleCreateOption = () => {
    if (!createTarget) {
      return
    }

    const trimmedName = createName.trim()
    if (trimmedName.length < 2) {
      toast.error(`${createTarget.label} name must be at least 2 characters.`)
      return
    }

    startCreateOption(async () => {
      const result = await createOnboardingSelectEntityAction({
        companyId: form.companyId,
        entity: createTarget.entity,
        name: trimmedName,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setDynamicOptions((prev) => ({
        ...prev,
        [createTarget.key]: [...prev[createTarget.key], result.option].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      updateSection("employment", createTarget.employmentField, result.option.id)
      setCreateTarget(null)
      setCreateName("")
      toast.success(`${createTarget.label} added.`)
    })
  }

  return (
    <main className="min-h-screen w-full bg-background">
      {/* ── Header band ─────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-6 border-b border-border/60 px-8 pb-8 pt-8 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">2-step employee creation with profile image and scanned documents upload.</p>
          <div className="flex items-center gap-4">
            <h1 className="inline-flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
              <IconUserPlus className="h-7 w-7" />
              Employee Onboarding
            </h1>
            <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              {companyName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Completion {completion.score}%</Badge>
          <Button type="button" onClick={() => setIsConfirmOpen(true)} disabled={isPending}>
            <IconCheck className="size-4" /> {isPending ? "Creating..." : "Create Employee"}
          </Button>
        </div>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create employee record</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to create <span className="font-medium text-foreground">{employeeDisplayName}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Creating..." : "Confirm Create"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(createTarget)} onOpenChange={(open) => !open && setCreateTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {createTarget?.label}</DialogTitle>
            <DialogDescription>Create a new {createTarget?.label?.toLowerCase()} without leaving onboarding.</DialogDescription>
          </DialogHeader>
          <Field label={`${createTarget?.label ?? "Record"} Name`} required>
            <Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder={`Enter ${createTarget?.label?.toLowerCase()} name`} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateTarget(null)} disabled={isCreatingOption}>Cancel</Button>
            <Button type="button" onClick={handleCreateOption} disabled={isCreatingOption}>{isCreatingOption ? "Adding..." : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Step tabs ───────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-border/60 px-8">
        <button
          type="button"
          onClick={() => setStep("stepOne")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
            step === "stepOne"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          <IconId className="size-3.5" /> Step 1: Identity & Contact
        </button>
        <button
          type="button"
          onClick={() => setStep("stepTwo")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
            step === "stepTwo"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          <IconBriefcase className="size-3.5" /> Step 2: Employment, Payroll & Tax
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === "stepOne" ? (
          <motion.div
            key="step-one"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── Identity section ──────────────────────────────── */}
            <div className="border-b border-border/60">
              <div className="px-8 py-4">
                <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <IconId className="h-3.5 w-3.5" /> Identity
                </h2>
              </div>
              <div className="grid gap-4 px-8 pb-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => profileInputRef.current?.click()}
                          className="group relative flex h-56 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border/70 bg-muted/20 text-muted-foreground transition hover:border-primary/50 hover:bg-muted/40"
                        >
                          {form.uploads.profilePhotoDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={form.uploads.profilePhotoDataUrl} alt="Profile preview" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <IconPhoto className="size-8" />
                              <span className="text-xs">Upload profile photo</span>
                            </div>
                          )}
                        </button>
                        <input
                          ref={profileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            void handleProfilePhotoFile(event.target.files?.[0])
                            event.currentTarget.value = ""
                          }}
                        />
                        <p className="truncate text-[11px] text-muted-foreground">
                          {form.uploads.profilePhotoFileName ?? "No profile image selected"}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <Field label="Employee ID" required><Input value={form.identity.employeeNumber} onChange={(event) => updateSection("identity", "employeeNumber", event.target.value)} /></Field>
                        <Field label="First Name" required><Input value={form.identity.firstName} onChange={(event) => updateSection("identity", "firstName", event.target.value)} /></Field>
                        <Field label="Middle Name"><Input value={form.identity.middleName ?? ""} onChange={(event) => updateSection("identity", "middleName", event.target.value || undefined)} /></Field>
                        <Field label="Last Name" required><Input value={form.identity.lastName} onChange={(event) => updateSection("identity", "lastName", event.target.value)} /></Field>
                        <Field label="Suffix"><Input value={form.identity.suffix ?? ""} onChange={(event) => updateSection("identity", "suffix", event.target.value || undefined)} /></Field>
                        <Field label="Nickname"><Input value={form.identity.nickname ?? ""} onChange={(event) => updateSection("identity", "nickname", event.target.value || undefined)} /></Field>
                        <DateField label="Birth Date" required value={form.identity.birthDate} onChange={(value) => updateSection("identity", "birthDate", value)} />
                        <Field label="Birth Place"><Input value={form.identity.birthPlace ?? ""} onChange={(event) => updateSection("identity", "birthPlace", event.target.value || undefined)} /></Field>
                        <Field label="Gender" required>
                          <Select value={form.identity.genderId} onValueChange={(value) => updateSection("identity", "genderId", value as EmployeeOnboardingInput["identity"]["genderId"])}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>{options.genders.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <SelectWithNone label="Civil Status" value={form.identity.civilStatusId} options={options.civilStatuses} onChange={(value) => updateSection("identity", "civilStatusId", value as EmployeeOnboardingInput["identity"]["civilStatusId"])} />
                        <Field label="Nationality"><Input value={form.identity.nationality ?? ""} onChange={(event) => updateSection("identity", "nationality", event.target.value || undefined)} /></Field>
                        <Field label="Citizenship"><Input value={form.identity.citizenship ?? ""} onChange={(event) => updateSection("identity", "citizenship", event.target.value || undefined)} /></Field>
                </div>
              </div>
            </div>

            {/* ── Contact section ─────────────────────────────── */}
            <div className="border-b border-border/60">
              <div className="px-8 py-4">
                <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contact Information
                </h2>
              </div>
              <div className="grid gap-3 px-8 pb-6 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Mobile Number" required><Input value={form.contact.mobileNumber} onChange={(event) => updateSection("contact", "mobileNumber", event.target.value)} /></Field>
                      <Field label="Personal Email" required><Input type="email" value={form.contact.personalEmail} onChange={(event) => updateSection("contact", "personalEmail", event.target.value)} /></Field>
                      <Field label="Work Email"><Input type="email" value={form.contact.workEmail ?? ""} onChange={(event) => updateSection("contact", "workEmail", event.target.value || undefined)} /></Field>
                      <Field label="Street"><Input value={form.contact.street ?? ""} onChange={(event) => updateSection("contact", "street", event.target.value || undefined)} /></Field>
                      <Field label="Barangay"><Input value={form.contact.barangay ?? ""} onChange={(event) => updateSection("contact", "barangay", event.target.value || undefined)} /></Field>
                      <Field label="City"><Input value={form.contact.city ?? ""} onChange={(event) => updateSection("contact", "city", event.target.value || undefined)} /></Field>
                      <Field label="Province"><Input value={form.contact.province ?? ""} onChange={(event) => updateSection("contact", "province", event.target.value || undefined)} /></Field>
                      <Field label="Postal Code"><Input value={form.contact.postalCode ?? ""} onChange={(event) => updateSection("contact", "postalCode", event.target.value || undefined)} /></Field>
                      <Field label="Emergency Contact Name"><Input value={form.contact.emergencyContactName ?? ""} onChange={(event) => updateSection("contact", "emergencyContactName", event.target.value || undefined)} /></Field>
                      <Field label="Emergency Contact Number"><Input value={form.contact.emergencyContactNumber ?? ""} onChange={(event) => updateSection("contact", "emergencyContactNumber", event.target.value || undefined)} /></Field>
                      <SelectWithNone label="Emergency Relationship" value={form.contact.emergencyRelationshipId} options={options.relationships} onChange={(value) => updateSection("contact", "emergencyRelationshipId", value as EmployeeOnboardingInput["contact"]["emergencyRelationshipId"])} />
              </div>
            </div>

            {/* ── Documents section ──────────────────────────── */}
            <div className="border-b border-border/60">
              <div className="px-8 py-4">
                <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <IconFile className="h-3.5 w-3.5" /> Scanned Documents
                </h2>
              </div>
              <div className="px-8 pb-6">
                        <button
                          type="button"
                          onClick={() => documentsInputRef.current?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground transition hover:bg-muted/40"
                        >
                          <IconUpload className="size-4" />
                          Upload scanned files
                        </button>
                        <input
                          ref={documentsInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            void handleDocumentFiles(event.target.files)
                            event.currentTarget.value = ""
                          }}
                        />
                        <p className="mt-2 text-[11px] text-muted-foreground">Up to 10 files. PDF and image files are recommended.</p>
              </div>

              <div className="space-y-2 px-8 pb-6">
                      {form.uploads.scannedDocuments.length === 0 ? (
                        <p className="rounded-md border border-dashed border-border/70 p-3 text-xs text-muted-foreground">No scanned documents attached.</p>
                      ) : (
                        form.uploads.scannedDocuments.map((document, index) => (
                          <div key={`${document.fileName}-${index}`} className="grid gap-2 rounded-md border border-border/60 bg-background p-2 sm:grid-cols-[1fr_180px_120px_auto] sm:items-center">
                            <div className="flex items-center gap-2 text-muted-foreground"><IconFile className="size-4" /></div>
                            <Field label="Title"><Input value={document.title} onChange={(event) => {
                              const value = event.target.value
                              setForm((prev) => ({
                                ...prev,
                                uploads: {
                                  ...prev.uploads,
                                  scannedDocuments: prev.uploads.scannedDocuments.map((row, rowIndex) => rowIndex === index ? { ...row, title: value } : row),
                                },
                              }))
                            }} /></Field>
                            <Field label="Type">
                              <Select value={document.documentTypeId} onValueChange={(value) => {
                                setForm((prev) => ({
                                  ...prev,
                                  uploads: {
                                    ...prev.uploads,
                                    scannedDocuments: prev.uploads.scannedDocuments.map((row, rowIndex) =>
                                      rowIndex === index ? { ...row, documentTypeId: value as EmployeeOnboardingInput["uploads"]["scannedDocuments"][number]["documentTypeId"] } : row
                                    ),
                                  },
                                }))
                              }}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>{documentTypeOptions.map((option) => <SelectItem key={option} value={option}>{option.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                              </Select>
                            </Field>
                            <p className="text-[11px] text-muted-foreground">{Math.round(document.fileSize / 1024)} KB</p>
                            <Button type="button" size="sm" variant="ghost" onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                uploads: {
                                  ...prev.uploads,
                                  scannedDocuments: prev.uploads.scannedDocuments.filter((_, rowIndex) => rowIndex !== index),
                                },
                              }))
                            }}>
                              <IconX className="size-4" />
                            </Button>
                          </div>
                        ))
                      )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step-two"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── Employment section ──────────────────────────── */}
            <div className="border-b border-border/60">
              <div className="px-8 py-4">
                <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <IconBriefcase className="h-3.5 w-3.5" /> Employment
                </h2>
              </div>
              <div className="grid gap-3 px-8 pb-6 sm:grid-cols-2 lg:grid-cols-4">
                    <DateField label="Hire Date" required value={form.employment.hireDate} onChange={(value) => updateSection("employment", "hireDate", value)} />
                    <OptionSelect label="Employment Status" required value={form.employment.employmentStatusId} options={dynamicOptions.employmentStatuses} onChange={(value) => updateSection("employment", "employmentStatusId", value)} allowCreate createLabel="Add status" onCreateRequested={() => openCreateDialog("employmentStatuses")} />
                    <OptionSelect label="Employment Type" required value={form.employment.employmentTypeId} options={dynamicOptions.employmentTypes} onChange={(value) => updateSection("employment", "employmentTypeId", value)} allowCreate createLabel="Add type" onCreateRequested={() => openCreateDialog("employmentTypes")} />
                    <OptionSelect label="Employment Class" required value={form.employment.employmentClassId} options={dynamicOptions.employmentClasses} onChange={(value) => updateSection("employment", "employmentClassId", value)} allowCreate createLabel="Add class" onCreateRequested={() => openCreateDialog("employmentClasses")} />
                    <OptionSelect label="Department" required value={form.employment.departmentId} options={dynamicOptions.departments} onChange={(value) => updateSection("employment", "departmentId", value)} allowCreate createLabel="Add department" onCreateRequested={() => openCreateDialog("departments")} />
                    <OptionSelect label="Division" value={form.employment.divisionId ?? ""} options={dynamicOptions.divisions} onChange={(value) => updateSection("employment", "divisionId", value || undefined)} allowEmpty allowCreate createLabel="Add division" onCreateRequested={() => openCreateDialog("divisions")} />
                    <OptionSelect label="Position" required value={form.employment.positionId} options={dynamicOptions.positions} onChange={(value) => updateSection("employment", "positionId", value)} allowCreate createLabel="Add position" onCreateRequested={() => openCreateDialog("positions")} />
                    <OptionSelect label="Rank" value={form.employment.rankId ?? ""} options={dynamicOptions.ranks} onChange={(value) => updateSection("employment", "rankId", value || undefined)} allowEmpty allowCreate createLabel="Add rank" onCreateRequested={() => openCreateDialog("ranks")} />
                    <OptionSelect label="Branch" value={form.employment.branchId ?? ""} options={dynamicOptions.branches} onChange={(value) => updateSection("employment", "branchId", value || undefined)} allowEmpty allowCreate createLabel="Add branch" onCreateRequested={() => openCreateDialog("branches")} />
                    <OptionSelect label="Reporting Manager" value={form.employment.reportingManagerId ?? ""} options={options.managers} onChange={(value) => updateSection("employment", "reportingManagerId", value || undefined)} allowEmpty />
                    <DateField label="Probation End" value={form.employment.probationEndDate ?? ""} onChange={(value) => updateSection("employment", "probationEndDate", value || undefined)} />
                    <DateField label="Regularization Date" value={form.employment.regularizationDate ?? ""} onChange={(value) => updateSection("employment", "regularizationDate", value || undefined)} />
              </div>
            </div>

            {/* ── Payroll section ────────────────────────────── */}
            <div className="border-b border-border/60">
              <div className="px-8 py-4">
                <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payroll
                </h2>
              </div>
              <div className="grid gap-3 px-8 pb-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Monthly Rate" required><Input type="number" value={form.payroll.monthlyRate} onChange={(event) => updateSection("payroll", "monthlyRate", Number(event.target.value) || 0)} /></Field>
                    <Field label="Daily Rate"><Input type="number" value={dailyRatePreview} disabled /></Field>
                    <Field label="Hourly Rate"><Input type="number" value={hourlyRatePreview} disabled /></Field>
                    <OptionSelect label="Work Schedule" required value={form.payroll.workScheduleId} options={options.workSchedules} onChange={(value) => updateSection("payroll", "workScheduleId", value)} />
                    <OptionSelect label="Pay Period Pattern" required value={form.payroll.payPeriodPatternId} options={options.payPeriodPatterns} onChange={(value) => updateSection("payroll", "payPeriodPatternId", value)} />
                    <Field label="Monthly Divisor" required><Input type="number" value={form.payroll.monthlyDivisor} disabled /></Field>
                    <Field label="Hours Per Day" required><Input type="number" step="0.25" value={form.payroll.hoursPerDay} disabled /></Field>
                    <Field label="Minimum Wage Region"><Input value={form.payroll.minimumWageRegion ?? ""} onChange={(event) => updateSection("payroll", "minimumWageRegion", event.target.value || undefined)} /></Field>
                    <SwitchField label="Night Differential Eligible" checked={form.payroll.isNightDiffEligible} onCheckedChange={(checked) => updateSection("payroll", "isNightDiffEligible", checked)} />
                    <SwitchField label="Overtime Eligible" checked={form.payroll.isOvertimeEligible} onCheckedChange={(checked) => updateSection("payroll", "isOvertimeEligible", checked)} />
                    <SwitchField label="WFH Eligible" checked={form.payroll.isWfhEligible} onCheckedChange={(checked) => updateSection("payroll", "isWfhEligible", checked)} />
                    <Field label="WFH Schedule"><Input value={form.payroll.wfhSchedule ?? ""} onChange={(event) => updateSection("payroll", "wfhSchedule", event.target.value || undefined)} /></Field>
              </div>
            </div>

            {/* ── Tax section ────────────────────────────────── */}
            <div className="border-b border-border/60">
              <div className="px-8 py-4">
                <h2 className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tax & Government IDs
                </h2>
              </div>
              <div className="grid gap-3 px-8 pb-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Tax Status" required>
                      <Select value={form.tax.taxStatusId} onValueChange={(value) => updateSection("tax", "taxStatusId", value as EmployeeOnboardingInput["tax"]["taxStatusId"])}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{options.taxStatuses.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Dependents"><Input type="number" value={form.tax.numberOfDependents} onChange={(event) => updateSection("tax", "numberOfDependents", Number(event.target.value) || 0)} /></Field>
                    <SwitchField label="Substituted Filing" checked={form.tax.isSubstitutedFiling} onCheckedChange={(checked) => updateSection("tax", "isSubstitutedFiling", checked)} />
                    <Field label="TIN"><Input value={form.tax.tin ?? ""} onChange={(event) => updateSection("tax", "tin", event.target.value || undefined)} /></Field>
                    <Field label="SSS Number"><Input value={form.tax.sssNumber ?? ""} onChange={(event) => updateSection("tax", "sssNumber", event.target.value || undefined)} /></Field>
                    <Field label="PhilHealth Number"><Input value={form.tax.philHealthNumber ?? ""} onChange={(event) => updateSection("tax", "philHealthNumber", event.target.value || undefined)} /></Field>
                    <Field label="Pag-IBIG Number"><Input value={form.tax.pagIbigNumber ?? ""} onChange={(event) => updateSection("tax", "pagIbigNumber", event.target.value || undefined)} /></Field>
                    <Field label="Previous Employer Income"><Input type="number" value={form.tax.previousEmployerIncome ?? ""} onChange={(event) => updateSection("tax", "previousEmployerIncome", event.target.value === "" ? undefined : Number(event.target.value) || 0)} /></Field>
                    <Field label="Previous Tax Withheld"><Input type="number" value={form.tax.previousEmployerTaxWithheld ?? ""} onChange={(event) => updateSection("tax", "previousEmployerTaxWithheld", event.target.value === "" ? undefined : Number(event.target.value) || 0)} /></Field>
                    <div className="sm:col-span-2 lg:col-span-4"><Field label="Notes"><Textarea className="h-20" value={form.tax.notes ?? ""} onChange={(event) => updateSection("tax", "notes", event.target.value || undefined)} /></Field></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step navigation footer ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between border-t border-border/60 px-8 py-4">
        <Button type="button" variant="outline" size="sm" className="border-border/60" disabled={step === "stepOne" || isPending} onClick={() => setStep("stepOne")}>
          <IconChevronLeft className="size-4" /> Previous
        </Button>
        <Button type="button" variant="outline" size="sm" className="border-border/60" disabled={step === "stepTwo" || isPending} onClick={() => setStep("stepTwo")}>
          Next <IconChevronRight className="size-4" />
        </Button>
      </div>
    </main>
  )
}

function DateField({ label, required, value, onChange }: { label: string; required?: boolean; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} required={required}>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between">
            <span>{value ? formatDisplayDate(value) : "Select date"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <Calendar mode="single" selected={value ? new Date(`${value}T00:00:00+08:00`) : undefined} onSelect={(date) => onChange(toPhDateInputValue(date))} />
        </PopoverContent>
      </Popover>
    </Field>
  )
}

function OptionSelect({
  label,
  required,
  value,
  options,
  onChange,
  allowEmpty,
  allowCreate,
  createLabel,
  onCreateRequested,
}: {
  label: string
  required?: boolean
  value: string
  options: Option[]
  onChange: (value: string) => void
  allowEmpty?: boolean
  allowCreate?: boolean
  createLabel?: string
  onCreateRequested?: () => void
}) {
  const noneValue = "__none__"
  const createValue = "__create__"

  return (
    <Field label={label} required={required}>
      <Select
        value={allowEmpty && !value ? noneValue : (value || undefined)}
        onValueChange={(nextValue) => {
          if (allowCreate && nextValue === createValue) {
            onCreateRequested?.()
            return
          }

          onChange(allowEmpty && nextValue === noneValue ? "" : nextValue)
        }}
      >
        <SelectTrigger className="w-full"><SelectValue placeholder={options.length === 0 ? "No options" : "Select option"} /></SelectTrigger>
        <SelectContent>
          {allowCreate ? (
            <SelectItem value={createValue} className="font-medium text-blue-600 focus:text-blue-700">
              <span className="inline-flex items-center gap-2">
                <IconPlus className="size-3.5" />
                {createLabel ?? `Add ${label}`}
              </span>
            </SelectItem>
          ) : null}
          {allowEmpty ? <SelectItem value={noneValue}>None</SelectItem> : null}
          {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  )
}

function SelectWithNone<T extends string | undefined>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ id: Exclude<T, undefined>; name: string }>
  onChange: (value: T) => void
}) {
  const noneValue = "__none__"

  return (
    <Field label={label}>
      <Select value={value ?? noneValue} onValueChange={(nextValue) => onChange((nextValue === noneValue ? undefined : nextValue) as T)}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={noneValue}>None</SelectItem>
          {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  )
}



function SwitchField({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <Field label={label}>
      <div className="flex h-7 items-center justify-between rounded-md border border-input bg-background px-2 py-0.5">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </Field>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required ? <Required /> : null}</Label>
      {children}
    </div>
  )
}
