import { NextRequest, NextResponse } from "next/server"

import { requireMigrationToken, resolveMigrationScopeId } from "@/lib/api/migration-auth"
import { prisma } from "@/lib/prisma"

const toNumber = (value: { toNumber: () => number } | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const parsed = value.toNumber()
  return Number.isFinite(parsed) ? parsed : null
}

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
    const rows = await prisma.materialRequest.findMany({
      where: {
        businessUnitId: scopeId,
      },
      select: {
        id: true,
        docNo: true,
        series: true,
        type: true,
        status: true,
        datePrepared: true,
        dateRequired: true,
        dateApproved: true,
        datePosted: true,
        dateRevised: true,
        createdAt: true,
        updatedAt: true,
        chargeTo: true,
        bldgCode: true,
        purpose: true,
        remarks: true,
        deliverTo: true,
        isStoreUse: true,
        freight: true,
        discount: true,
        total: true,
        confirmationNo: true,
        supplierBPCode: true,
        supplierName: true,
        purchaseOrderNumber: true,
        processedAt: true,
        servedAt: true,
        servedNotes: true,
        reviewStatus: true,
        reviewedAt: true,
        reviewRemarks: true,
        budgetApprovalStatus: true,
        budgetApprovalDate: true,
        budgetRemarks: true,
        isWithinBudget: true,
        recApprovalStatus: true,
        recApprovalDate: true,
        recApprovalRemarks: true,
        finalApprovalStatus: true,
        finalApprovalDate: true,
        finalApprovalRemarks: true,
        acknowledgedAt: true,
        requestedById: true,
        reviewerId: true,
        budgetApproverId: true,
        recApproverId: true,
        finalApproverId: true,
        servedBy: true,
        processedBy: true,
        acknowledgedById: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            employeeId: true,
            name: true,
          },
        },
        items: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            itemCode: true,
            description: true,
            uom: true,
            quantity: true,
            quantityServed: true,
            unitPrice: true,
            totalPrice: true,
            remarks: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    })

    const actorIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [
            row.requestedById,
            row.reviewerId,
            row.budgetApproverId,
            row.recApproverId,
            row.finalApproverId,
            row.servedBy,
            row.processedBy,
            row.acknowledgedById,
          ])
          .filter((value): value is string => Boolean(value))
      )
    )

    const actors =
      actorIds.length > 0
        ? await prisma.user.findMany({
            where: {
              id: {
                in: actorIds,
              },
            },
            select: {
              id: true,
              employeeId: true,
              name: true,
            },
          })
        : []

    const actorById = new Map(actors.map((actor) => [actor.id, actor]))

    const data = rows.map((row) => {
      const reviewer = row.reviewerId ? actorById.get(row.reviewerId) : null
      const budgetApprover = row.budgetApproverId ? actorById.get(row.budgetApproverId) : null
      const recApprover = row.recApproverId ? actorById.get(row.recApproverId) : null
      const finalApprover = row.finalApproverId ? actorById.get(row.finalApproverId) : null
      const servedBy = row.servedBy ? actorById.get(row.servedBy) : null
      const processedBy = row.processedBy ? actorById.get(row.processedBy) : null
      const acknowledgedBy = row.acknowledgedById ? actorById.get(row.acknowledgedById) : null

      return {
        id: row.id,
        docNo: row.docNo,
        series: row.series,
        requestType: row.type,
        status: row.status,
        datePrepared: row.datePrepared,
        dateRequired: row.dateRequired,
        dateApproved: row.dateApproved,
        datePosted: row.datePosted,
        dateRevised: row.dateRevised,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        chargeTo: row.chargeTo,
        bldgCode: row.bldgCode,
        purpose: row.purpose,
        remarks: row.remarks,
        deliverTo: row.deliverTo,
        isStoreUse: row.isStoreUse,
        freight: toNumber(row.freight) ?? 0,
        discount: toNumber(row.discount) ?? 0,
        total: toNumber(row.total) ?? 0,
        confirmationNo: row.confirmationNo,
        supplierBPCode: row.supplierBPCode,
        supplierName: row.supplierName,
        purchaseOrderNumber: row.purchaseOrderNumber,
        processedAt: row.processedAt,
        servedAt: row.servedAt,
        servedNotes: row.servedNotes,
        acknowledgedAt: row.acknowledgedAt,
        isWithinBudget: row.isWithinBudget,
        reviewStatus: row.reviewStatus,
        reviewedAt: row.reviewedAt,
        reviewRemarks: row.reviewRemarks,
        budgetApprovalStatus: row.budgetApprovalStatus,
        budgetApprovalDate: row.budgetApprovalDate,
        budgetRemarks: row.budgetRemarks,
        recApprovalStatus: row.recApprovalStatus,
        recApprovalDate: row.recApprovalDate,
        recApprovalRemarks: row.recApprovalRemarks,
        finalApprovalStatus: row.finalApprovalStatus,
        finalApprovalDate: row.finalApprovalDate,
        finalApprovalRemarks: row.finalApprovalRemarks,
        requestedByEmployeeId: row.requestedBy.employeeId,
        requestedByName: row.requestedBy.name,
        reviewerEmployeeId: reviewer?.employeeId ?? "",
        reviewerName: reviewer?.name ?? "",
        budgetApproverEmployeeId: budgetApprover?.employeeId ?? "",
        budgetApproverName: budgetApprover?.name ?? "",
        recApproverEmployeeId: recApprover?.employeeId ?? "",
        recApproverName: recApprover?.name ?? "",
        finalApproverEmployeeId: finalApprover?.employeeId ?? "",
        finalApproverName: finalApprover?.name ?? "",
        servedByEmployeeId: servedBy?.employeeId ?? "",
        servedByName: servedBy?.name ?? "",
        processedByEmployeeId: processedBy?.employeeId ?? "",
        processedByName: processedBy?.name ?? "",
        acknowledgedByEmployeeId: acknowledgedBy?.employeeId ?? "",
        acknowledgedByName: acknowledgedBy?.name ?? "",
        department: {
          id: row.department?.id ?? null,
          code: row.department?.code ?? null,
          name: row.department?.name ?? null,
        },
        items: row.items.map((item) => ({
          id: item.id,
          itemCode: item.itemCode,
          description: item.description,
          uom: item.uom,
          quantity: toNumber(item.quantity) ?? 0,
          quantityServed: toNumber(item.quantityServed) ?? 0,
          unitPrice: toNumber(item.unitPrice),
          lineTotal: toNumber(item.totalPrice),
          remarks: item.remarks,
        })),
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Migration material request export failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error exporting material requests." },
      { status: 500 }
    )
  }
}
