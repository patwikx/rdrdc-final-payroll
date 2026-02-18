import { NextResponse } from "next/server"
import { BloodType, CivilStatus, Gender, Religion, TaxStatus } from "@prisma/client"

import { db } from "@/lib/db"
import { toPhDateInputValue } from "@/lib/ph-time"
import { createAuditLog, getRequestAuditMetadata } from "@/modules/audit/utils/audit-log"
import { ActiveCompanyContextError, getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess, type CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  buildEmployeeBulkTemplateCsv,
  csvEscape,
  EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS,
} from "@/modules/employees/masterlist/utils/employee-bulk-csv"
import {
  EMPLOYEE_BULK_BLOOD_TYPE_LABELS,
  EMPLOYEE_BULK_CIVIL_STATUS_LABELS,
  EMPLOYEE_BULK_GENDER_LABELS,
  EMPLOYEE_BULK_RELIGION_LABELS,
  EMPLOYEE_BULK_TAX_STATUS_LABELS,
} from "@/modules/employees/masterlist/utils/employee-bulk-enum-labels"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ companyId: string }>
}

const toDateStamp = (value: Date): string => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })
    .format(value)
    .replace(/\//g, "")
}

const decimalToString = (value: { toString(): string } | null | undefined): string => {
  if (!value) return ""
  return value.toString()
}

const boolToCsv = (value: boolean): string => {
  return value ? "TRUE" : "FALSE"
}

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params
  const auditMeta = getRequestAuditMetadata(request)

  try {
    const activeCompany = await getActiveCompanyContext({ companyId })

    if (!hasModuleAccess(activeCompany.companyRole as CompanyRole, "employees")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [
      employees,
      legendManagers,
      employmentStatuses,
      employmentTypes,
      employmentClasses,
      departments,
      divisions,
      positions,
      ranks,
      branches,
      workSchedules,
      payPeriodPatterns,
    ] = await Promise.all([
      db.employee.findMany({
        where: {
          companyId: activeCompany.companyId,
          deletedAt: null,
          employeeNumber: { not: "admin" },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          middleName: true,
          suffix: true,
          maidenName: true,
          nickname: true,
          birthDate: true,
          birthPlace: true,
          nationality: true,
          citizenship: true,
          genderId: true,
          civilStatusId: true,
          religionId: true,
          bloodTypeId: true,
          heightCm: true,
          weightKg: true,
          biometricId: true,
          rfidNumber: true,
          hireDate: true,
          applicationDate: true,
          interviewDate: true,
          jobOfferDate: true,
          probationStartDate: true,
          probationEndDate: true,
          regularizationDate: true,
          contractStartDate: true,
          contractEndDate: true,
          employmentStatus: {
            select: {
              code: true,
              name: true,
            },
          },
          employmentType: {
            select: {
              code: true,
              name: true,
            },
          },
          employmentClass: {
            select: {
              code: true,
              name: true,
            },
          },
          department: {
            select: {
              code: true,
              name: true,
            },
          },
          division: {
            select: {
              code: true,
              name: true,
            },
          },
          position: {
            select: {
              code: true,
              name: true,
            },
          },
          rank: {
            select: {
              code: true,
              name: true,
            },
          },
          branch: {
            select: {
              code: true,
              name: true,
            },
          },
          reportingManager: {
            select: {
              employeeNumber: true,
            },
          },
          workSchedule: {
            select: {
              code: true,
              name: true,
            },
          },
          payPeriodPattern: {
            select: {
              code: true,
              name: true,
            },
          },
          taxStatusId: true,
          numberOfDependents: true,
          previousEmployerIncome: true,
          previousEmployerTaxWithheld: true,
          isSubstitutedFiling: true,
          isOvertimeEligible: true,
          isNightDiffEligible: true,
          isAuthorizedSignatory: true,
          isWfhEligible: true,
          wfhSchedule: true,
          salary: {
            select: {
              baseSalary: true,
              monthlyDivisor: true,
              hoursPerDay: true,
              salaryGrade: true,
              salaryBand: true,
              minimumWageRegion: true,
            },
          },
          contacts: {
            where: {
              isPrimary: true,
              isActive: true,
            },
            select: {
              number: true,
            },
            take: 1,
          },
          emails: {
            where: {
              emailTypeId: "PERSONAL",
              isPrimary: true,
              isActive: true,
            },
            select: {
              email: true,
            },
            take: 1,
          },
        },
      }),
      db.employee.findMany({
        where: {
          companyId: activeCompany.companyId,
          deletedAt: null,
          employeeNumber: { not: "admin" },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      }),
      db.employmentStatus.findMany({
        where: { companyId: activeCompany.companyId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true },
      }),
      db.employmentType.findMany({
        where: { companyId: activeCompany.companyId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true },
      }),
      db.employmentClass.findMany({
        where: { companyId: activeCompany.companyId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true },
      }),
      db.department.findMany({
        where: { companyId: activeCompany.companyId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true },
      }),
      db.division.findMany({
        where: { companyId: activeCompany.companyId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true },
      }),
      db.position.findMany({
        where: { companyId: activeCompany.companyId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true },
      }),
      db.rank.findMany({
        where: { companyId: activeCompany.companyId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true },
      }),
      db.branch.findMany({
        where: { companyId: activeCompany.companyId, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { code: true, name: true },
      }),
      db.workSchedule.findMany({
        where: { isActive: true, OR: [{ companyId: activeCompany.companyId }, { companyId: null }] },
        orderBy: [{ companyId: "desc" }, { name: "asc" }],
        select: { code: true, name: true, companyId: true },
      }),
      db.payPeriodPattern.findMany({
        where: { isActive: true, OR: [{ companyId: activeCompany.companyId }, { companyId: null }] },
        orderBy: [{ companyId: "desc" }, { name: "asc" }],
        select: { code: true, name: true, companyId: true },
      }),
    ])

    const toLookupLabel = (lookup: { code: string; name: string } | null): string => {
      if (!lookup) return ""
      return lookup.code || lookup.name
    }

    const rows = employees.map((employee) => ({
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName ?? "",
      suffix: employee.suffix ?? "",
      maidenName: employee.maidenName ?? "",
      nickname: employee.nickname ?? "",
      birthDate: toPhDateInputValue(employee.birthDate),
      birthPlace: employee.birthPlace ?? "",
      nationality: employee.nationality ?? "",
      citizenship: employee.citizenship ?? "",
      gender: employee.genderId ? EMPLOYEE_BULK_GENDER_LABELS[employee.genderId] : "",
      civilStatus: employee.civilStatusId ? EMPLOYEE_BULK_CIVIL_STATUS_LABELS[employee.civilStatusId] : "",
      religion: employee.religionId ? EMPLOYEE_BULK_RELIGION_LABELS[employee.religionId] : "",
      bloodType: employee.bloodTypeId ? EMPLOYEE_BULK_BLOOD_TYPE_LABELS[employee.bloodTypeId] : "",
      heightCm: decimalToString(employee.heightCm),
      weightKg: decimalToString(employee.weightKg),
      mobileNumber: employee.contacts[0]?.number ?? "",
      personalEmail: employee.emails[0]?.email ?? "",
      biometricId: employee.biometricId ?? "",
      rfidNumber: employee.rfidNumber ?? "",
      hireDate: toPhDateInputValue(employee.hireDate),
      applicationDate: toPhDateInputValue(employee.applicationDate ?? undefined),
      interviewDate: toPhDateInputValue(employee.interviewDate ?? undefined),
      jobOfferDate: toPhDateInputValue(employee.jobOfferDate ?? undefined),
      probationStartDate: toPhDateInputValue(employee.probationStartDate ?? undefined),
      probationEndDate: toPhDateInputValue(employee.probationEndDate ?? undefined),
      regularizationDate: toPhDateInputValue(employee.regularizationDate ?? undefined),
      contractStartDate: toPhDateInputValue(employee.contractStartDate ?? undefined),
      contractEndDate: toPhDateInputValue(employee.contractEndDate ?? undefined),
      employmentStatus: toLookupLabel(employee.employmentStatus),
      employmentType: toLookupLabel(employee.employmentType),
      employmentClass: toLookupLabel(employee.employmentClass),
      department: toLookupLabel(employee.department),
      division: toLookupLabel(employee.division),
      position: toLookupLabel(employee.position),
      rank: toLookupLabel(employee.rank),
      branch: toLookupLabel(employee.branch),
      reportingManagerEmployeeNumber: employee.reportingManager?.employeeNumber ?? "",
      workSchedule: toLookupLabel(employee.workSchedule),
      payPeriodPattern: toLookupLabel(employee.payPeriodPattern),
      taxStatus: employee.taxStatusId ? EMPLOYEE_BULK_TAX_STATUS_LABELS[employee.taxStatusId] : "",
      numberOfDependents: String(employee.numberOfDependents),
      previousEmployerIncome: decimalToString(employee.previousEmployerIncome),
      previousEmployerTaxWithheld: decimalToString(employee.previousEmployerTaxWithheld),
      monthlyRate: decimalToString(employee.salary?.baseSalary),
      monthlyDivisor: employee.salary?.monthlyDivisor ? String(employee.salary.monthlyDivisor) : "",
      hoursPerDay: decimalToString(employee.salary?.hoursPerDay),
      salaryGrade: employee.salary?.salaryGrade ?? "",
      salaryBand: employee.salary?.salaryBand ?? "",
      minimumWageRegion: employee.salary?.minimumWageRegion ?? "",
      wfhSchedule: employee.wfhSchedule ?? "",
      tinNumber: "",
      sssNumber: "",
      philHealthNumber: "",
      pagIbigNumber: "",
      umidNumber: "",
      isSubstitutedFiling: boolToCsv(employee.isSubstitutedFiling),
      isOvertimeEligible: boolToCsv(employee.isOvertimeEligible),
      isNightDiffEligible: boolToCsv(employee.isNightDiffEligible),
      isAuthorizedSignatory: boolToCsv(employee.isAuthorizedSignatory),
      isWfhEligible: boolToCsv(employee.isWfhEligible),
    }))

    const templateCsv = buildEmployeeBulkTemplateCsv(rows, {
      requiredHeaders: EMPLOYEE_BULK_UPDATE_REQUIRED_HEADERS,
    })
    const legendRows: string[][] = [
      ["# LEGEND GUIDE (rows that start with # are ignored by bulk import)"],
      ["# Columns marked with * in the header are required by the importer."],
      ["# category", "code", "name", "scope", "templateColumn"],
      ...employmentStatuses.map((item) => ["# employmentStatus", item.code, item.name, "COMPANY", "employmentStatus"]),
      ...employmentTypes.map((item) => ["# employmentType", item.code, item.name, "COMPANY", "employmentType"]),
      ...employmentClasses.map((item) => ["# employmentClass", item.code, item.name, "COMPANY", "employmentClass"]),
      ...departments.map((item) => ["# department", item.code, item.name, "COMPANY", "department"]),
      ...divisions.map((item) => ["# division", item.code, item.name, "COMPANY", "division"]),
      ...positions.map((item) => ["# position", item.code, item.name, "COMPANY", "position"]),
      ...ranks.map((item) => ["# rank", item.code, item.name, "COMPANY", "rank"]),
      ...branches.map((item) => ["# branch", item.code, item.name, "COMPANY", "branch"]),
      ...workSchedules.map((item) => [
        "# workSchedule",
        item.code,
        item.name,
        item.companyId ? "COMPANY" : "GLOBAL",
        "workSchedule",
      ]),
      ...payPeriodPatterns.map((item) => [
        "# payPeriodPattern",
        item.code,
        item.name,
        item.companyId ? "COMPANY" : "GLOBAL",
        "payPeriodPattern",
      ]),
      ...legendManagers.map((item) => [
        "# reportingManager",
        item.employeeNumber,
        `${item.lastName}, ${item.firstName}`,
        item.isActive ? "COMPANY_ACTIVE" : "COMPANY_INACTIVE",
        "reportingManagerEmployeeNumber",
      ]),
      ...Object.values(Gender).map((value) => ["# gender", value, EMPLOYEE_BULK_GENDER_LABELS[value], "ENUM", "gender"]),
      ...Object.values(CivilStatus).map((value) => [
        "# civilStatus",
        value,
        EMPLOYEE_BULK_CIVIL_STATUS_LABELS[value],
        "ENUM",
        "civilStatus",
      ]),
      ...Object.values(Religion).map((value) => ["# religion", value, EMPLOYEE_BULK_RELIGION_LABELS[value], "ENUM", "religion"]),
      ...Object.values(BloodType).map((value) => ["# bloodType", value, EMPLOYEE_BULK_BLOOD_TYPE_LABELS[value], "ENUM", "bloodType"]),
      ...Object.values(TaxStatus).map((value) => [
        "# taxStatus",
        value,
        EMPLOYEE_BULK_TAX_STATUS_LABELS[value],
        "ENUM",
        "taxStatus",
      ]),
    ]
    const legendCsv = legendRows.map((row) => row.map(csvEscape).join(",")).join("\n")
    const csv = `${templateCsv}\n\n${legendCsv}`
    const fileName = `employee-bulk-update-template-${toDateStamp(new Date())}.csv`

    await createAuditLog({
      tableName: "Employee",
      recordId: activeCompany.companyId,
      action: "UPDATE",
      userId: activeCompany.userId,
      reason: "EXPORT_EMPLOYEE_BULK_UPDATE_TEMPLATE_CSV",
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
      changes: [
        { fieldName: "rowCount", newValue: rows.length },
        { fieldName: "legendRowCount", newValue: legendRows.length },
      ],
    })

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    if (error instanceof ActiveCompanyContextError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Unable to generate employee bulk update template." }, { status: 500 })
  }
}
