import type { MaterialRequestStatus, Prisma } from "@prisma/client"

import { db } from "@/lib/db"

type DbClient = Prisma.TransactionClient | typeof db

export const buildLegacyMaterialRequestWhere = (
  companyId: string
): Prisma.MaterialRequestWhereInput => {
  return {
    companyId,
    OR: [
      { legacySourceSystem: { not: null } },
      { legacyRecordId: { not: null } },
    ],
  }
}

export type LegacyMaterialRequestCleanupSummary = {
  totalLegacyRequests: number
  requestsWithLegacyRecordId: number
  requestsWithLegacySourceSystem: number
  statusCounts: Array<{
    status: MaterialRequestStatus
    count: number
  }>
  firstCreatedAt: Date | null
  lastCreatedAt: Date | null
}

export type LegacyMaterialRequestCleanupRow = {
  id: string
  requestNumber: string
  legacySourceSystem: string | null
  legacyRecordId: string | null
  status: MaterialRequestStatus
  requesterName: string
  requesterEmployeeNumber: string
  departmentCode: string
  departmentName: string
  datePrepared: Date
  createdAt: Date
  updatedAt: Date
}

export async function getLegacyMaterialRequestCleanupSummary(params: {
  companyId: string
  client?: DbClient
}): Promise<LegacyMaterialRequestCleanupSummary> {
  const client = params.client ?? db
  const legacyWhere = buildLegacyMaterialRequestWhere(params.companyId)

  const [
    totalLegacyRequests,
    requestsWithLegacyRecordId,
    requestsWithLegacySourceSystem,
    groupedByStatus,
    firstCreatedRow,
    lastCreatedRow,
  ] = await Promise.all([
    client.materialRequest.count({
      where: legacyWhere,
    }),
    client.materialRequest.count({
      where: {
        companyId: params.companyId,
        legacyRecordId: {
          not: null,
        },
      },
    }),
    client.materialRequest.count({
      where: {
        companyId: params.companyId,
        legacySourceSystem: {
          not: null,
        },
      },
    }),
    client.materialRequest.groupBy({
      by: ["status"],
      where: legacyWhere,
      _count: {
        _all: true,
      },
      orderBy: {
        status: "asc",
      },
    }),
    client.materialRequest.findFirst({
      where: legacyWhere,
      orderBy: {
        createdAt: "asc",
      },
      select: {
        createdAt: true,
      },
    }),
    client.materialRequest.findFirst({
      where: legacyWhere,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    }),
  ])

  const statusCounts = groupedByStatus
    .map((row) => ({
      status: row.status,
      count: row._count._all,
    }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count
      }

      return left.status.localeCompare(right.status)
    })

  return {
    totalLegacyRequests,
    requestsWithLegacyRecordId,
    requestsWithLegacySourceSystem,
    statusCounts,
    firstCreatedAt: firstCreatedRow?.createdAt ?? null,
    lastCreatedAt: lastCreatedRow?.createdAt ?? null,
  }
}

export async function getLegacyMaterialRequestCleanupRows(params: {
  companyId: string
  client?: DbClient
}): Promise<LegacyMaterialRequestCleanupRow[]> {
  const client = params.client ?? db

  const rows = await client.materialRequest.findMany({
    where: buildLegacyMaterialRequestWhere(params.companyId),
    orderBy: [{ createdAt: "desc" }, { requestNumber: "desc" }],
    select: {
      id: true,
      requestNumber: true,
      legacySourceSystem: true,
      legacyRecordId: true,
      status: true,
      datePrepared: true,
      createdAt: true,
      updatedAt: true,
      requesterEmployee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
      department: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    requestNumber: row.requestNumber,
    legacySourceSystem: row.legacySourceSystem,
    legacyRecordId: row.legacyRecordId,
    status: row.status,
    requesterName: `${row.requesterEmployee.firstName} ${row.requesterEmployee.lastName}`.trim(),
    requesterEmployeeNumber: row.requesterEmployee.employeeNumber,
    departmentCode: row.department.code,
    departmentName: row.department.name,
    datePrepared: row.datePrepared,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}
