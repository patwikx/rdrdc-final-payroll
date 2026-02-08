"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { BloodType, CivilStatus, Gender, RelationshipType } from "@prisma/client"
import {
  IconAddressBook,
  IconBriefcase,
  IconCreditCard,
  IconEdit,
  IconFileText,
  IconMail,
  IconMapPin,
  IconPhone,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { updateEmployeeSelfServiceAction } from "@/modules/employee-portal/actions/profile-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ProfileData = {
  id: string
  employeeNumber: string
  firstName: string
  middleName: string | null
  lastName: string
  suffix: string | null
  birthDate: string
  nationality: string | null
  genderId: Gender | null
  civilStatusId: CivilStatus | null
  bloodTypeId: BloodType | null
  position: { name: string } | null
  department: { name: string } | null
  branch: { name: string } | null
  employmentStatus: { name: string } | null
  employmentType: { name: string } | null
  hireDate: string
  regularizationDate: string | null
  governmentIds: Array<{
    id: string
    idTypeId: string
    idNumberMasked: string | null
  }>
  addresses: Array<{
    id: string
    street: string | null
    barangay: string | null
    city: string | null
    province: string | null
    postalCode: string | null
    isPrimary: boolean
  }>
  contacts: Array<{
    id: string
    countryCode: string | null
    number: string
    isPrimary: boolean
  }>
  emails: Array<{
    id: string
    email: string
    isPrimary: boolean
  }>
  emergencyContacts: Array<{
    id: string
    name: string
    relationshipId: RelationshipType
    mobileNumber: string | null
    priority: number
  }>
  dependents: Array<{
    id: string
    firstName: string
    lastName: string
    middleName: string | null
    relationshipId: RelationshipType
    birthDate: string | null
    isTaxDependent: boolean
  }>
  documents: Array<{
    id: string
    title: string
    fileUrl: string
    fileType: string
    fileSize: number
  }>
}

type Props = {
  companyId: string
  employee: ProfileData
}

const enumLabel = (value: string | null | undefined): string => (value ? value.replace(/_/g, " ") : "N/A")

export function EmployeeProfilePortalClient({ companyId, employee }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const primaryAddress = useMemo(() => employee.addresses.find((item) => item.isPrimary) ?? null, [employee.addresses])
  const primaryEmail = useMemo(() => employee.emails.find((item) => item.isPrimary) ?? null, [employee.emails])
  const primaryContact = useMemo(() => employee.contacts.find((item) => item.isPrimary) ?? null, [employee.contacts])
  const primaryEmergency = useMemo(() => employee.emergencyContacts.find((item) => item.priority === 1) ?? null, [employee.emergencyContacts])
  const governmentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of employee.governmentIds) {
      if (item.idNumberMasked) {
        map.set(item.idTypeId, item.idNumberMasked)
      }
    }
    return map
  }, [employee.governmentIds])

  const [editEmail, setEditEmail] = useState(primaryEmail?.email ?? "")
  const [editPhone, setEditPhone] = useState(primaryContact?.number ?? "")
  const [editPhoneCountryCode, setEditPhoneCountryCode] = useState(primaryContact?.countryCode ?? "+63")
  const [editStreet, setEditStreet] = useState(primaryAddress?.street ?? "")
  const [editBarangay, setEditBarangay] = useState(primaryAddress?.barangay ?? "")
  const [editCity, setEditCity] = useState(primaryAddress?.city ?? "")
  const [editProvince, setEditProvince] = useState(primaryAddress?.province ?? "")
  const [editPostalCode, setEditPostalCode] = useState(primaryAddress?.postalCode ?? "")
  const [editEmergencyName, setEditEmergencyName] = useState(primaryEmergency?.name ?? "")
  const [editEmergencyRelationship, setEditEmergencyRelationship] = useState<RelationshipType | "">(primaryEmergency?.relationshipId ?? "")
  const [editEmergencyPhone, setEditEmergencyPhone] = useState(primaryEmergency?.mobileNumber ?? "")
  const [documentDrafts, setDocumentDrafts] = useState<Array<{ id?: string; title: string; fileUrl: string; fileType: string; fileSize: number }>>(
    employee.documents.slice(0, 3).map((doc) => ({
      id: doc.id,
      title: doc.title,
      fileUrl: doc.fileUrl,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
    }))
  )

  const handleUpdate = () => {
    startTransition(async () => {
      const result = await updateEmployeeSelfServiceAction({
        companyId,
        email: editEmail || undefined,
        phone: editPhone || undefined,
        phoneCountryCode: editPhoneCountryCode || undefined,
        address: {
          street: editStreet || undefined,
          barangay: editBarangay || undefined,
          city: editCity || undefined,
          province: editProvince || undefined,
          postalCode: editPostalCode || undefined,
        },
        emergencyContact: {
          name: editEmergencyName || undefined,
          relationshipId: editEmergencyRelationship || undefined,
          mobileNumber: editEmergencyPhone || undefined,
        },
        documents: documentDrafts
          .filter((item) => item.title.trim() && item.fileUrl.trim() && item.fileType.trim())
          .map((item) => ({
            id: item.id,
            title: item.title.trim(),
            fileUrl: item.fileUrl.trim(),
            fileType: item.fileType.trim().toUpperCase(),
            fileSize: item.fileSize,
          })),
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="w-full min-h-screen bg-background pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Employee Record</p>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">My Profile</h1>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Personal & Employment Data</div>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-lg bg-primary hover:bg-primary/90">
              <IconEdit className="mr-2 h-4 w-4" />
              Update Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-[95vw] rounded-2xl border-border/60 shadow-none sm:!max-w-[450px]">
            <DialogHeader className="mb-3 border-b border-border/60 pb-3">
              <DialogTitle className="text-base font-semibold">Update Contact Information</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">Update your email, phone, and emergency contact</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-xs text-foreground">Email Address</Label>
                <Input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} className="rounded-lg text-sm" />
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-foreground">Phone Number</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={editPhoneCountryCode} onChange={(event) => setEditPhoneCountryCode(event.target.value)} className="rounded-lg text-sm" />
                  <Input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} className="col-span-2 rounded-lg text-sm" />
                </div>
              </div>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-xs text-muted-foreground">Primary Address</p>
                <Input value={editStreet} onChange={(event) => setEditStreet(event.target.value)} placeholder="Street" className="rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editBarangay} onChange={(event) => setEditBarangay(event.target.value)} placeholder="Barangay" className="rounded-lg text-sm" />
                  <Input value={editCity} onChange={(event) => setEditCity(event.target.value)} placeholder="City" className="rounded-lg text-sm" />
                  <Input value={editProvince} onChange={(event) => setEditProvince(event.target.value)} placeholder="Province" className="rounded-lg text-sm" />
                  <Input value={editPostalCode} onChange={(event) => setEditPostalCode(event.target.value)} placeholder="Postal Code" className="rounded-lg text-sm" />
                </div>
              </div>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-xs text-muted-foreground">Emergency Contact</p>
                <Input value={editEmergencyName} onChange={(event) => setEditEmergencyName(event.target.value)} placeholder="Contact Name" className="rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={editEmergencyRelationship} onValueChange={(value) => setEditEmergencyRelationship(value as RelationshipType)}>
                    <SelectTrigger className="rounded-lg text-sm">
                      <SelectValue placeholder="Relationship" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="SPOUSE">Spouse</SelectItem>
                      <SelectItem value="CHILD">Child</SelectItem>
                      <SelectItem value="PARENT">Parent</SelectItem>
                      <SelectItem value="SIBLING">Sibling</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={editEmergencyPhone} onChange={(event) => setEditEmergencyPhone(event.target.value)} placeholder="Mobile Number" className="rounded-lg text-sm" />
                </div>
              </div>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Documents</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDocumentDrafts((prev) => [
                        ...prev,
                        { title: "", fileUrl: "", fileType: "PDF", fileSize: 1024 },
                      ])
                    }
                  >
                    Add Document
                  </Button>
                </div>
                <div className="space-y-2">
                  {documentDrafts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No document entries yet.</p>
                  ) : (
                    documentDrafts.map((document, index) => (
                      <div key={`${document.id ?? "new"}-${index}`} className="space-y-2 rounded-lg border border-border/60 p-3">
                        <Input
                          value={document.title}
                          onChange={(event) =>
                            setDocumentDrafts((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, title: event.target.value } : item
                              )
                            )
                          }
                          placeholder="Document title"
                          className="rounded-lg text-sm"
                        />
                        <Input
                          value={document.fileUrl}
                          onChange={(event) =>
                            setDocumentDrafts((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, fileUrl: event.target.value } : item
                              )
                            )
                          }
                          placeholder="Document URL"
                          className="rounded-lg text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={document.fileType}
                            onChange={(event) =>
                              setDocumentDrafts((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, fileType: event.target.value } : item
                                )
                              )
                            }
                            placeholder="Type (PDF/JPG)"
                            className="rounded-lg text-sm"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={document.fileSize}
                            onChange={(event) =>
                              setDocumentDrafts((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, fileSize: Number(event.target.value) || 1 } : item
                                )
                              )
                            }
                            placeholder="File size (bytes)"
                            className="rounded-lg text-sm"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDocumentDrafts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg">Cancel</Button>
                <Button onClick={handleUpdate} disabled={isPending} className="rounded-lg">{isPending ? "Updating..." : "Update"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2">
        <Section title="Personal Information" icon={<IconUser className="h-4 w-4 text-primary" />}>
          <Field label="Full Name" value={`${employee.firstName} ${employee.middleName ?? ""} ${employee.lastName} ${employee.suffix ?? ""}`.replace(/\s+/g, " ").trim()} large />
          <div className="grid grid-cols-2 gap-6">
            <Field label="Employee ID" value={employee.employeeNumber} />
            <Field label="Birth Date" value={new Date(employee.birthDate).toLocaleDateString("en-PH")} />
            <Field label="Gender" value={enumLabel(employee.genderId)} />
            <Field label="Civil Status" value={enumLabel(employee.civilStatusId)} />
            <Field label="Nationality" value={employee.nationality || "N/A"} />
            <Field label="Blood Type" value={enumLabel(employee.bloodTypeId)} />
          </div>
        </Section>

        <Section title="Employment Details" icon={<IconBriefcase className="h-4 w-4 text-primary" />}>
          <Field label="Position" value={employee.position?.name || "N/A"} large highlight />
          <div className="grid grid-cols-2 gap-6">
            <Field label="Department" value={employee.department?.name || "N/A"} />
            <Field label="Branch" value={employee.branch?.name || "N/A"} />
            <Field label="Status" value={employee.employmentStatus?.name || "N/A"} />
            <Field label="Type" value={employee.employmentType?.name || "N/A"} />
            <Field label="Hire Date" value={new Date(employee.hireDate).toLocaleDateString("en-PH")} />
            <Field label="Regularization" value={employee.regularizationDate ? new Date(employee.regularizationDate).toLocaleDateString("en-PH") : "N/A"} />
          </div>
        </Section>

        <Section title="Contact Information" icon={<IconAddressBook className="h-4 w-4 text-primary" />}>
          <div className="space-y-4">
            {primaryEmail ? <IconRow icon={<IconMail className="h-4 w-4 text-muted-foreground" />} label="Email Address" value={primaryEmail.email} /> : null}
            {primaryContact ? <IconRow icon={<IconPhone className="h-4 w-4 text-muted-foreground" />} label="Phone Number" value={`${primaryContact.countryCode ?? ""} ${primaryContact.number}`.trim()} /> : null}
            {primaryAddress ? <IconRow icon={<IconMapPin className="h-4 w-4 text-muted-foreground" />} label="Address" value={[primaryAddress.street, primaryAddress.barangay, primaryAddress.city, primaryAddress.province, primaryAddress.postalCode].filter(Boolean).join(", ")} /> : null}
          </div>
          {primaryEmergency ? (
            <>
              <Separator className="bg-border/60" />
              <div>
                <p className="mb-3 text-xs text-muted-foreground">Emergency Contact</p>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{primaryEmergency.name}</p>
                    <p className="text-xs text-muted-foreground">{enumLabel(primaryEmergency.relationshipId)}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{primaryEmergency.mobileNumber}</p>
                </div>
              </div>
            </>
          ) : null}
        </Section>

        <Section title="Government IDs" icon={<IconCreditCard className="h-4 w-4 text-primary" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Mini label="SSS Number" value={governmentMap.get("SSS") || "N/A"} />
            <Mini label="PhilHealth" value={governmentMap.get("PHILHEALTH") || "N/A"} />
            <Mini label="Pag-IBIG" value={governmentMap.get("PAGIBIG") || "N/A"} />
            <Mini label="TIN" value={governmentMap.get("TIN") || "N/A"} />
          </div>
        </Section>

        <Section title="My Documents" icon={<IconFileText className="h-4 w-4 text-primary" />}>
          {employee.documents.length > 0 ? (
            <div className="space-y-2">
              {employee.documents.map((doc) => (
                <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.fileType} - {(doc.fileSize / 1024).toFixed(0)} KB</p>
                  </div>
                  <span className="text-xs font-medium text-primary">Open</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No documents uploaded yet</p>
          )}
        </Section>

        <Section title="Dependents" icon={<IconUsers className="h-4 w-4 text-primary" />}>
          {employee.dependents.length > 0 ? (
            <div className="space-y-3">
              {employee.dependents.map((dep) => (
                <div key={dep.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{dep.firstName} {dep.middleName} {dep.lastName}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">{enumLabel(dep.relationshipId)}</p>
                      {dep.birthDate ? <p className="text-xs text-muted-foreground">Born: {new Date(dep.birthDate).toLocaleDateString("en-PH")}</p> : null}
                      {dep.isTaxDependent ? <span className="text-xs font-medium text-primary">Tax Dependent</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No dependents on record</p>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:bg-muted/20">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 p-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {icon}
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  )
}

function Field({ label, value, large = false, highlight = false }: { label: string; value: string; large?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm text-foreground", large && "text-lg font-semibold", highlight && "text-primary")}>{value}</p>
    </div>
  )
}

function IconRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/10">{icon}</div>
      <div>
        <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-4">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
