import { NextRequest } from "next/server"

import { db } from "@/lib/db"
import { requireMobileSession, getMobileEmployeeContext } from "@/modules/auth/utils/mobile-session"
import { mobileError, mobileOk } from "@/modules/auth/utils/mobile-api"
import { updateEmployeeSelfServiceAction } from "@/modules/employee-portal/actions/profile-actions"
import { updateEmployeeSelfServiceInputSchema } from "@/modules/employee-portal/schemas/profile-actions-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const updatePayloadSchema = updateEmployeeSelfServiceInputSchema.omit({ companyId: true })

const resolveCompanyId = (companyId: string | null | undefined, fallback: string): string => companyId ?? fallback

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null)

export async function GET(request: NextRequest) {
  const session = await requireMobileSession(request)
  if (!session.ok) {
    return session.response
  }

  const companyId = resolveCompanyId(session.context.user.companyId, session.context.claims.companyId)
  const employeeContext = await getMobileEmployeeContext({
    userId: session.context.user.id,
    companyId,
  })

  if (!employeeContext) {
    return mobileError("Employee profile not found for the active company.", 404)
  }

  const employee = await db.employee.findUnique({
    where: { id: employeeContext.id },
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
    return mobileError("Employee profile not found for the active company.", 404)
  }

  return mobileOk({
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
    regularizationDate: toIso(employee.regularizationDate),
    governmentIds: employee.governmentIds,
    addresses: employee.addresses,
    contacts: employee.contacts,
    emails: employee.emails,
    emergencyContacts: employee.emergencyContacts,
    dependents: employee.dependents.map((item) => ({
      ...item,
      birthDate: toIso(item.birthDate),
    })),
    documents: employee.documents,
  })
}

export async function PUT(request: NextRequest) {
  const session = await requireMobileSession(request)
  if (!session.ok) {
    return session.response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return mobileError("Invalid JSON payload.", 400)
  }

  const parsed = updatePayloadSchema.safeParse(body)
  if (!parsed.success) {
    return mobileError(parsed.error.issues[0]?.message ?? "Invalid profile update payload.", 400)
  }

  const result = await updateEmployeeSelfServiceAction({
    companyId: resolveCompanyId(session.context.user.companyId, session.context.claims.companyId),
    ...parsed.data,
  })

  if (!result.ok) {
    return mobileError(result.error, 400)
  }

  return mobileOk({ updated: true }, result.message)
}
