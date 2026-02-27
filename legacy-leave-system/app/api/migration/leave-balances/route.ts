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
    const rows = await prisma.leaveBalance.findMany({
      where: {
        user: {
          businessUnitId: scopeId,
        },
      },
      select: {
        id: true,
        year: true,
        allocatedDays: true,
        usedDays: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
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
      orderBy: [{ year: "asc" }, { createdAt: "asc" }],
    })

    const data = rows.map((row) => ({
      id: row.id,
      employeeId: row.user.employeeId,
      employeeName: row.user.name,
      leaveTypeId: row.leaveType.id,
      leaveTypeName: row.leaveType.name,
      year: row.year,
      allocatedDays: row.allocatedDays,
      usedDays: row.usedDays,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Migration leave balance export failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error exporting leave balances." },
      { status: 500 }
    )
  }
}

