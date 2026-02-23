import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"
import { EmployeeProfilePortalClient } from "@/modules/employee-portal/components/employee-profile-portal-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type ProfilePageProps = {
  params: Promise<{ companyId: string }>
}

const dateTimeLabel = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Manila",
})

const formatDateTime = (value: Date | null): string | null => {
  if (!value) {
    return null
  }

  return dateTimeLabel.format(value)
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  if (!context.employee) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Your account is not linked to an employee profile for this company yet.
        </CardContent>
      </Card>
    )
  }

  const [employee, acknowledgedMaterialRequests] = await Promise.all([
    db.employee.findUnique({
      where: { id: context.employee.id },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        photoUrl: true,
        birthDate: true,
        nationality: true,
        genderId: true,
        civilStatusId: true,
        bloodTypeId: true,
        hireDate: true,
        regularizationDate: true,
        position: { select: { name: true } },
        department: { select: { name: true } },
        branch: { select: { name: true } },
        employmentStatus: { select: { name: true } },
        employmentType: { select: { name: true } },
        addresses: {
          where: { isActive: true },
          select: {
            id: true,
            street: true,
            barangay: true,
            city: true,
            province: true,
            postalCode: true,
            isPrimary: true,
          },
        },
        contacts: {
          where: { isActive: true },
          select: {
            id: true,
            countryCode: true,
            number: true,
            isPrimary: true,
          },
        },
        emails: {
          where: { isActive: true },
          select: {
            id: true,
            email: true,
            isPrimary: true,
          },
        },
        emergencyContacts: {
          where: { isActive: true },
          orderBy: { priority: "asc" },
          select: {
            id: true,
            name: true,
            relationshipId: true,
            mobileNumber: true,
            priority: true,
          },
        },
        dependents: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            relationshipId: true,
            birthDate: true,
            isTaxDependent: true,
          },
        },
        documents: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
          },
        },
        governmentIds: {
          where: { isActive: true },
          select: {
            id: true,
            idTypeId: true,
            idNumberMasked: true,
          },
        },
      },
    }),
    db.materialRequest.findMany({
      where: {
        companyId: context.companyId,
        requesterUserId: context.userId,
        requesterAcknowledgedAt: { not: null },
      },
      orderBy: [{ requesterAcknowledgedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        requestNumber: true,
        requesterAcknowledgedAt: true,
        processingCompletedAt: true,
        items: {
          orderBy: { lineNumber: "asc" },
          select: {
            id: true,
            lineNumber: true,
            itemCode: true,
            description: true,
            uom: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            remarks: true,
          },
        },
        receivingReports: {
          orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            id: true,
            reportNumber: true,
            receivedAt: true,
          },
        },
      },
    }),
  ])

  if (!employee) {
    redirect("/login")
  }

  return (
    <EmployeeProfilePortalClient
      companyId={context.companyId}
      employee={{
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        middleName: employee.middleName,
        lastName: employee.lastName,
        suffix: employee.suffix,
        photoUrl: employee.photoUrl,
        birthDate: employee.birthDate.toISOString(),
        nationality: employee.nationality,
        genderId: employee.genderId,
        civilStatusId: employee.civilStatusId,
        bloodTypeId: employee.bloodTypeId,
        position: employee.position,
        department: employee.department,
        branch: employee.branch,
        employmentStatus: employee.employmentStatus,
        employmentType: employee.employmentType,
        hireDate: employee.hireDate.toISOString(),
        regularizationDate: employee.regularizationDate?.toISOString() ?? null,
        governmentIds: employee.governmentIds,
        addresses: employee.addresses,
        contacts: employee.contacts,
        emails: employee.emails,
        emergencyContacts: employee.emergencyContacts,
        dependents: employee.dependents.map((item) => ({
          ...item,
          birthDate: item.birthDate?.toISOString() ?? null,
        })),
        documents: employee.documents,
        acknowledgedMaterialItems: acknowledgedMaterialRequests.flatMap((request) =>
          request.items.map((item) => ({
            itemId: item.id,
            lineNumber: item.lineNumber,
            itemCode: item.itemCode,
            description: item.description,
            uom: item.uom,
            quantity: Number(item.quantity),
            unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
            lineTotal: item.lineTotal === null ? null : Number(item.lineTotal),
            remarks: item.remarks,
            requestId: request.id,
            requestNumber: request.requestNumber,
            acknowledgedAtLabel: formatDateTime(request.requesterAcknowledgedAt),
            processingCompletedAtLabel: formatDateTime(request.processingCompletedAt),
            receivingReportId: request.receivingReports[0]?.id ?? null,
            receivingReportNumber: request.receivingReports[0]?.reportNumber ?? null,
            receivingReportReceivedAtLabel: formatDateTime(request.receivingReports[0]?.receivedAt ?? null),
          }))
        ),
      }}
    />
  )
}
