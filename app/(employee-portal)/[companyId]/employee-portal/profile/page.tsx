import { redirect } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"
import { EmployeeProfilePortalClient } from "@/modules/employee-portal/components/employee-profile-portal-client"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type ProfilePageProps = {
  params: Promise<{ companyId: string }>
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

  const employee = await db.employee.findUnique({
    where: { id: context.employee.id },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
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
  })

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
      }}
    />
  )
}
