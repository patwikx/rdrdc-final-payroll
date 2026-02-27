import { NextRequest, NextResponse } from "next/server"

import { requireMigrationToken, resolveMigrationScopeId } from "@/lib/api/migration-auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const authError = requireMigrationToken(request)
  if (authError) return authError

  const scopeId = resolveMigrationScopeId(request)
  if (!scopeId) {
    return NextResponse.json(
      { error: "Missing scope. Provide businessUnitId or companyId query param." },
      { status: 400 }
    )
  }

  try {
    const rows = await prisma.leaveRequest.findMany({
      where: {
        user: {
          businessUnitId: scopeId,
        },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
        status: true,
        session: true,
        managerActionBy: true,
        managerActionAt: true,
        managerComments: true,
        hrActionBy: true,
        hrActionAt: true,
        hrComments: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            employeeId: true,
            name: true,
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    })

    const approverIds = Array.from(
      new Set(
        rows.flatMap((row) => [row.managerActionBy, row.hrActionBy]).filter((value): value is string => Boolean(value))
      )
    )

    const approvers =
      approverIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: approverIds } },
            select: {
              id: true,
              employeeId: true,
              name: true,
            },
          })
        : []

    const approverById = new Map(approvers.map((item) => [item.id, item]))

    const data = rows.map((row) => {
      const manager = row.managerActionBy ? approverById.get(row.managerActionBy) : null
      const hr = row.hrActionBy ? approverById.get(row.hrActionBy) : null

      return {
        id: row.id,
        employeeId: row.user.employeeId,
        employeeName: row.user.name,
        leaveTypeId: row.leaveType.id,
        leaveTypeName: row.leaveType.name,
        startDate: row.startDate,
        endDate: row.endDate,
        reason: row.reason,
        status: row.status,
        session: row.session,
        managerActionAt: row.managerActionAt,
        managerComments: row.managerComments,
        managerEmployeeId: manager?.employeeId ?? "",
        managerName: manager?.name ?? "",
        hrActionAt: row.hrActionAt,
        hrComments: row.hrComments,
        hrEmployeeId: hr?.employeeId ?? "",
        hrName: hr?.name ?? "",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Migration leave request export failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error exporting leave requests." },
      { status: 500 }
    )
  }
}

