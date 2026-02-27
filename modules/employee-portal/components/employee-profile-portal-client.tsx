"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { BloodType, CivilStatus, Gender, RelationshipType } from "@prisma/client"
import {
  IconClipboardCheck,
  IconAddressBook,
  IconBriefcase,
  IconCreditCard,
  IconEdit,
  IconExternalLink,
  IconFileText,
  IconLock,
  IconMail,
  IconMapPin,
  IconPhoto,
  IconPhone,
  IconReceipt2,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { changeOwnPasswordAction } from "@/modules/account/actions/change-own-password-action"
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
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type ProfileData = {
  id: string
  employeeNumber: string
  firstName: string
  middleName: string | null
  lastName: string
  suffix: string | null
  photoUrl: string | null
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
  acknowledgedMaterialItems: Array<{
    itemId: string
    lineNumber: number
    itemCode: string | null
    description: string
    uom: string
    quantity: number
    unitPrice: number | null
    lineTotal: number | null
    remarks: string | null
    requestId: string
    requestNumber: string
    acknowledgedAtLabel: string | null
    processingCompletedAtLabel: string | null
    receivingReportId: string | null
    receivingReportNumber: string | null
    receivingReportReceivedAtLabel: string | null
  }>
}

type Props = {
  companyId: string
  employee: ProfileData
}

type ProfilePhotoEditorSource = {
  objectUrl: string
  naturalWidth: number
  naturalHeight: number
}

const PHOTO_EDITOR_VIEWPORT_SIZE = 288
const PROFILE_PHOTO_OUTPUT_SIZE = 640

const enumLabel = (value: string | null | undefined): string => (value ? value.replace(/_/g, " ") : "N/A")

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const disposePhotoEditorSource = (source: ProfilePhotoEditorSource | null): void => {
  if (!source) {
    return
  }

  URL.revokeObjectURL(source.objectUrl)
}

const loadPhotoEditorSource = async (file: File): Promise<ProfilePhotoEditorSource> => {
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Failed to decode image"))
      image.src = objectUrl
    })
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }

  return {
    objectUrl,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  }
}

export function EmployeeProfilePortalClient({ companyId, employee }: Props) {
  const [isProfilePending, startProfileTransition] = useTransition()
  const [isPasswordPending, startPasswordTransition] = useTransition()
  const [isPhotoPending, startPhotoTransition] = useTransition()
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false)
  const [photoEditorSource, setPhotoEditorSource] = useState<ProfilePhotoEditorSource | null>(null)
  const [photoEditorZoom, setPhotoEditorZoom] = useState(1)
  const [photoEditorOffsetX, setPhotoEditorOffsetX] = useState(0)
  const [photoEditorOffsetY, setPhotoEditorOffsetY] = useState(0)
  const router = useRouter()
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null)

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
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(employee.photoUrl)
  const [documentDrafts, setDocumentDrafts] = useState<Array<{ id?: string; title: string; fileUrl: string; fileType: string; fileSize: number }>>(
    employee.documents.slice(0, 3).map((doc) => ({
      id: doc.id,
      title: doc.title,
      fileUrl: doc.fileUrl,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
    }))
  )

  const photoEditorLayout = useMemo(() => {
    if (!photoEditorSource) {
      return null
    }

    const baseScale = Math.max(
      PHOTO_EDITOR_VIEWPORT_SIZE / photoEditorSource.naturalWidth,
      PHOTO_EDITOR_VIEWPORT_SIZE / photoEditorSource.naturalHeight
    )
    const displayScale = baseScale * photoEditorZoom
    const scaledWidth = photoEditorSource.naturalWidth * displayScale
    const scaledHeight = photoEditorSource.naturalHeight * displayScale
    const maxOffsetX = Math.max(0, (scaledWidth - PHOTO_EDITOR_VIEWPORT_SIZE) / 2)
    const maxOffsetY = Math.max(0, (scaledHeight - PHOTO_EDITOR_VIEWPORT_SIZE) / 2)
    const clampedOffsetX = clamp(photoEditorOffsetX, -maxOffsetX, maxOffsetX)
    const clampedOffsetY = clamp(photoEditorOffsetY, -maxOffsetY, maxOffsetY)
    const imageLeft = (PHOTO_EDITOR_VIEWPORT_SIZE - scaledWidth) / 2 + clampedOffsetX
    const imageTop = (PHOTO_EDITOR_VIEWPORT_SIZE - scaledHeight) / 2 + clampedOffsetY

    return {
      baseScale,
      displayScale,
      scaledWidth,
      scaledHeight,
      maxOffsetX,
      maxOffsetY,
      clampedOffsetX,
      clampedOffsetY,
      imageLeft,
      imageTop,
    }
  }, [photoEditorOffsetX, photoEditorOffsetY, photoEditorSource, photoEditorZoom])

  useEffect(() => {
    return () => {
      disposePhotoEditorSource(photoEditorSource)
    }
  }, [photoEditorSource])

  const handleUpdate = () => {
    startProfileTransition(async () => {
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
      setIsContactDialogOpen(false)
      router.refresh()
    })
  }

  const handleResetPassword = () => {
    startPasswordTransition(async () => {
      const result = await changeOwnPasswordAction({
        companyId,
        currentPassword,
        newPassword,
        confirmPassword,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setIsPasswordDialogOpen(false)
    })
  }

  const closePhotoEditor = () => {
    setIsPhotoEditorOpen(false)
    setPhotoEditorZoom(1)
    setPhotoEditorOffsetX(0)
    setPhotoEditorOffsetY(0)
    setPhotoEditorSource((current) => {
      disposePhotoEditorSource(current)
      return null
    })
  }

  const handlePhotoZoomChange = (value: number[]) => {
    const nextZoom = value[0] ?? 1
    setPhotoEditorZoom(nextZoom)

    if (!photoEditorSource) {
      return
    }

    const baseScale = Math.max(
      PHOTO_EDITOR_VIEWPORT_SIZE / photoEditorSource.naturalWidth,
      PHOTO_EDITOR_VIEWPORT_SIZE / photoEditorSource.naturalHeight
    )
    const scaledWidth = photoEditorSource.naturalWidth * baseScale * nextZoom
    const scaledHeight = photoEditorSource.naturalHeight * baseScale * nextZoom
    const maxOffsetX = Math.max(0, (scaledWidth - PHOTO_EDITOR_VIEWPORT_SIZE) / 2)
    const maxOffsetY = Math.max(0, (scaledHeight - PHOTO_EDITOR_VIEWPORT_SIZE) / 2)

    setPhotoEditorOffsetX((current) => clamp(current, -maxOffsetX, maxOffsetX))
    setPhotoEditorOffsetY((current) => clamp(current, -maxOffsetY, maxOffsetY))
  }

  const renderProfilePhotoDataUrl = async (): Promise<string> => {
    if (!photoEditorSource || !photoEditorLayout) {
      throw new Error("No image selected for editing.")
    }

    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Failed to prepare cropped image."))
      image.src = photoEditorSource.objectUrl
    })

    const canvas = document.createElement("canvas")
    canvas.width = PROFILE_PHOTO_OUTPUT_SIZE
    canvas.height = PROFILE_PHOTO_OUTPUT_SIZE

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Failed to process selected image.")
    }

    const sourceSide = PHOTO_EDITOR_VIEWPORT_SIZE / photoEditorLayout.displayScale
    const rawSourceX = (0 - photoEditorLayout.imageLeft) / photoEditorLayout.displayScale
    const rawSourceY = (0 - photoEditorLayout.imageTop) / photoEditorLayout.displayScale
    const maxSourceX = Math.max(0, photoEditorSource.naturalWidth - sourceSide)
    const maxSourceY = Math.max(0, photoEditorSource.naturalHeight - sourceSide)
    const sourceX = clamp(rawSourceX, 0, maxSourceX)
    const sourceY = clamp(rawSourceY, 0, maxSourceY)

    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSide,
      sourceSide,
      0,
      0,
      PROFILE_PHOTO_OUTPUT_SIZE,
      PROFILE_PHOTO_OUTPUT_SIZE
    )

    return canvas.toDataURL("image/jpeg", 0.92)
  }

  const handleApplyPhotoEdit = () => {
    const previousPreview = profilePhotoPreview

    startPhotoTransition(async () => {
      try {
        const dataUrl = await renderProfilePhotoDataUrl()
        setProfilePhotoPreview(dataUrl)

        const result = await updateEmployeeSelfServiceAction({
          companyId,
          profilePhotoDataUrl: dataUrl,
        })

        if (!result.ok) {
          setProfilePhotoPreview(previousPreview)
          toast.error(result.error)
          return
        }

        toast.success("Profile photo updated.")
        closePhotoEditor()
        router.refresh()
      } catch (error) {
        setProfilePhotoPreview(previousPreview)
        const message = error instanceof Error ? error.message : "Failed to upload profile photo."
        const sizeLimitMessage = message.toLowerCase().includes("body exceeded")
          ? "Image is too large for upload. Please use a smaller file."
          : "Failed to upload profile photo. Please try again."
        toast.error(sizeLimitMessage)
      }
    })
  }

  const handleProfilePhotoFile = async (file: File | undefined) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.")
      return
    }

    const maxImageBytes = 5 * 1024 * 1024
    if (file.size > maxImageBytes) {
      toast.error("Please select an image up to 5MB.")
      return
    }

    try {
      const nextSource = await loadPhotoEditorSource(file)
      setPhotoEditorSource((current) => {
        disposePhotoEditorSource(current)
        return nextSource
      })
      setPhotoEditorZoom(1)
      setPhotoEditorOffsetX(0)
      setPhotoEditorOffsetY(0)
      setIsPhotoEditorOpen(true)
    } catch {
      toast.error("Failed to process selected image.")
    }
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

        <div className="flex items-center gap-2">
          <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-lg">
                <IconLock className="mr-2 h-4 w-4" />
                Reset Password
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[95vw] rounded-2xl border-border/60 shadow-none sm:!max-w-[450px]">
              <DialogHeader className="mb-3 border-b border-border/60 pb-3">
                <DialogTitle className="text-base font-semibold">Reset Password</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Update your account password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">Current Password <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">New Password <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-foreground">Confirm Password <span className="text-destructive">*</span></Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="rounded-lg text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsPasswordDialogOpen(false)
                      setCurrentPassword("")
                      setNewPassword("")
                      setConfirmPassword("")
                    }}
                    className="rounded-lg"
                    disabled={isPasswordPending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleResetPassword} disabled={isPasswordPending} className="rounded-lg">
                    {isPasswordPending ? "Updating..." : "Reset Password"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
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
                  <Button variant="outline" onClick={() => setIsContactDialogOpen(false)} className="rounded-lg">Cancel</Button>
                  <Button onClick={handleUpdate} disabled={isProfilePending} className="rounded-lg">{isProfilePending ? "Updating..." : "Update"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-2">
        <Section title="Personal Information" icon={<IconUser className="h-4 w-4 text-primary" />}>
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => profilePhotoInputRef.current?.click()}
                className="flex h-56 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border/70 bg-muted/20 text-muted-foreground transition hover:border-primary/50 hover:bg-muted/40"
                disabled={isPhotoPending}
              >
                <Avatar className="h-full w-full rounded-lg after:rounded-lg">
                  <AvatarImage
                    src={profilePhotoPreview ?? undefined}
                    alt={`${employee.firstName} ${employee.lastName}`}
                    className="rounded-lg object-cover"
                  />
                  <AvatarFallback className="rounded-lg bg-transparent text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <IconPhoto className="size-8" />
                      <span className="text-xs">{isPhotoPending ? "Uploading..." : "Upload profile photo"}</span>
                    </div>
                  </AvatarFallback>
                </Avatar>
              </button>
              <input
                ref={profilePhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  handleProfilePhotoFile(event.target.files?.[0])
                  event.currentTarget.value = ""
                }}
              />
              <Dialog
                open={isPhotoEditorOpen}
                onOpenChange={(open) => {
                  if (!open && !isPhotoPending) {
                    closePhotoEditor()
                  }
                }}
              >
                <DialogContent className="w-[95vw] max-w-[95vw] rounded-2xl border-border/60 shadow-none sm:!max-w-[540px]">
                  <DialogHeader className="mb-3 border-b border-border/60 pb-3">
                    <DialogTitle className="text-base font-semibold">Adjust Profile Photo</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Crop and resize your photo before upload.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="mx-auto overflow-hidden rounded-xl border border-border/60 bg-muted/20" style={{ width: PHOTO_EDITOR_VIEWPORT_SIZE, height: PHOTO_EDITOR_VIEWPORT_SIZE }}>
                      {photoEditorSource && photoEditorLayout ? (
                        <div className="relative h-full w-full">
                          <img
                            src={photoEditorSource.objectUrl}
                            alt="Profile photo crop preview"
                            className="pointer-events-none absolute max-w-none select-none"
                            draggable={false}
                            style={{
                              width: `${photoEditorLayout.scaledWidth}px`,
                              height: `${photoEditorLayout.scaledHeight}px`,
                              left: `${photoEditorLayout.imageLeft}px`,
                              top: `${photoEditorLayout.imageTop}px`,
                            }}
                          />
                          <div className="pointer-events-none absolute inset-0 border border-primary/50" />
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Zoom</span>
                          <span>{photoEditorZoom.toFixed(2)}x</span>
                        </div>
                        <Slider value={[photoEditorZoom]} onValueChange={handlePhotoZoomChange} min={1} max={3} step={0.01} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Horizontal</span>
                          <span>{Math.round(photoEditorLayout?.clampedOffsetX ?? 0)}px</span>
                        </div>
                        <Slider
                          value={[photoEditorLayout?.clampedOffsetX ?? 0]}
                          onValueChange={(value) => setPhotoEditorOffsetX(value[0] ?? 0)}
                          min={-(photoEditorLayout?.maxOffsetX ?? 0)}
                          max={photoEditorLayout?.maxOffsetX ?? 0}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Vertical</span>
                          <span>{Math.round(photoEditorLayout?.clampedOffsetY ?? 0)}px</span>
                        </div>
                        <Slider
                          value={[photoEditorLayout?.clampedOffsetY ?? 0]}
                          onValueChange={(value) => setPhotoEditorOffsetY(value[0] ?? 0)}
                          min={-(photoEditorLayout?.maxOffsetY ?? 0)}
                          max={photoEditorLayout?.maxOffsetY ?? 0}
                          step={1}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
                      <Button variant="outline" onClick={closePhotoEditor} className="rounded-lg" disabled={isPhotoPending}>
                        Cancel
                      </Button>
                      <Button onClick={handleApplyPhotoEdit} className="rounded-lg" disabled={isPhotoPending || !photoEditorSource}>
                        {isPhotoPending ? "Uploading..." : "Apply Photo"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              <Field label="Full Name" value={`${employee.firstName} ${employee.middleName ?? ""} ${employee.lastName} ${employee.suffix ?? ""}`.replace(/\s+/g, " ").trim()} large />
              <div className="grid grid-cols-2 gap-6">
                <Field label="Employee ID" value={employee.employeeNumber} />
                <Field label="Birth Date" value={new Date(employee.birthDate).toLocaleDateString("en-PH")} />
                <Field label="Gender" value={enumLabel(employee.genderId)} />
                <Field label="Civil Status" value={enumLabel(employee.civilStatusId)} />
                <Field label="Nationality" value={employee.nationality || "N/A"} />
                <Field label="Blood Type" value={enumLabel(employee.bloodTypeId)} />
              </div>
            </div>
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

        <Section
          title="Acknowledged Materials"
          icon={<IconClipboardCheck className="h-4 w-4 text-primary" />}
          className="lg:col-span-2"
        >
          {employee.acknowledgedMaterialItems.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-background">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Line</TableHead>
                    <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Item Code</TableHead>
                    <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Description</TableHead>
                    <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">UOM</TableHead>
                    <TableHead className="h-9 px-3 text-right text-[11px] uppercase tracking-wide">Qty</TableHead>
                    <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Belongs To Request</TableHead>
                    <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Acknowledged At</TableHead>
                    <TableHead className="h-9 px-3 text-[11px] uppercase tracking-wide">Receiving Report</TableHead>
                    <TableHead className="h-9 px-3 text-right text-[11px] uppercase tracking-wide">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.acknowledgedMaterialItems.map((item) => (
                    <TableRow key={item.itemId} className="hover:bg-muted/20">
                      <TableCell className="px-3 py-3 text-foreground">{item.lineNumber}</TableCell>
                      <TableCell className="px-3 py-3 text-muted-foreground">{item.itemCode ?? "-"}</TableCell>
                      <TableCell className="px-3 py-3 text-foreground">
                        <p className="font-medium">{item.description}</p>
                        {item.remarks ? <p className="text-[11px] text-muted-foreground">{item.remarks}</p> : null}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-foreground">{item.uom}</TableCell>
                      <TableCell className="px-3 py-3 text-right text-foreground">{item.quantity.toFixed(3)}</TableCell>
                      <TableCell className="px-3 py-3 font-medium text-foreground">{item.requestNumber}</TableCell>
                      <TableCell className="px-3 py-3 text-muted-foreground">{item.acknowledgedAtLabel ?? "-"}</TableCell>
                      <TableCell className="px-3 py-3 text-muted-foreground">
                        {item.receivingReportNumber ?? "-"}
                        {item.receivingReportReceivedAtLabel ? ` (${item.receivingReportReceivedAtLabel})` : ""}
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" className="rounded-lg" asChild>
                            <Link href={`/${companyId}/employee-portal/material-requests/${item.requestId}`}>
                              View Request
                              <IconExternalLink className="ml-1 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {item.receivingReportId ? (
                            <Button type="button" size="sm" variant="outline" className="rounded-lg" asChild>
                              <Link href={`/${companyId}/employee-portal/material-request-receiving-reports/${item.receivingReportId}`}>
                                <IconReceipt2 className="mr-1 h-3.5 w-3.5" />
                                View Report
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No acknowledged material items yet.
            </p>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("group relative overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:bg-muted/20", className)}>
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
