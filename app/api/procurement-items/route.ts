import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

type ProcurementItemRouteRow = {
  id: string
  categoryId: string
  categoryCode: string
  categoryName: string
  code: string
  name: string
  description: string | null
  uom: string
  unitPrice: number | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const search = searchParams.get("search")?.trim() ?? ""
    const categoryId = searchParams.get("categoryId")?.trim() ?? ""

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId is required." }, { status: 400 })
    }

    await getActiveCompanyContext({ companyId })

    const [categories, items] = await Promise.all([
      db.procurementItemCategory.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ code: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      db.procurementItem.findMany({
        where: {
          isActive: true,
          category: {
            isActive: true,
          },
          ...(categoryId.length > 0 ? { categoryId } : {}),
          ...(search.length > 0
            ? {
                OR: [
                  { code: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ code: "asc" }],
        take: 300,
        select: {
          id: true,
          categoryId: true,
          code: true,
          name: true,
          description: true,
          uom: true,
          unitPrice: true,
          category: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
    ])

    const mappedItems: ProcurementItemRouteRow[] = items.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      categoryCode: item.category.code,
      categoryName: item.category.name,
      code: item.code,
      name: item.name,
      description: item.description,
      uom: item.uom,
      unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
    }))

    return NextResponse.json({
      success: true,
      data: {
        categories,
        items: mappedItems,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load procurement items."
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
