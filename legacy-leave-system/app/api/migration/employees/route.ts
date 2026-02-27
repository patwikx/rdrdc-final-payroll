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
    const rows = await prisma.user.findMany({
      where: {
        businessUnitId: scopeId,
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        password: true,
        profilePicture: true,
        role: true,
        classification: true,
        isActive: true,
        hireDate: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ employeeId: "asc" }],
    })

    const data = rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      name: row.name,
      email: row.email,
      passwordHash: row.password,
      profilePicture: row.profilePicture,
      role: row.role,
      classification: row.classification,
      isActive: row.isActive ?? true,
      hireDate: row.hireDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      departmentId: row.department?.id ?? null,
      departmentName: row.department?.name ?? null,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Migration employee export failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error exporting employees." },
      { status: 500 }
    )
  }
}
