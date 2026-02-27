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
    const rows = await prisma.overtimeRequest.findMany({
      where: {
        user: {
          businessUnitId: scopeId,
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        reason: true,
        status: true,
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
        startTime: row.startTime,
        endTime: row.endTime,
        overtimeDate: row.startTime,
        reason: row.reason,
        status: row.status,
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
    console.error("Migration overtime export failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error exporting overtime requests." },
      { status: 500 }
    )
  }
}

