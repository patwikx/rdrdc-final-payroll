import { NextRequest, NextResponse } from "next/server"

import { getConnection } from "@/lib/database"

type PurchaseOrderSupplier = {
  supplierCode: string | null
  supplierName: string | null
}

type PurchaseOrderSuppliersResponse = {
  success: boolean
  data: PurchaseOrderSupplier[]
  error?: string
  details?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get("search")?.trim() ?? ""

    const pool = await getConnection("db3")
    let query = `
      SELECT
        supplier_cd,
        name
      FROM mgr.po_supplier
    `

    if (searchTerm.length > 0) {
      query += `
        WHERE supplier_cd LIKE @searchTerm
          OR name LIKE @searchTerm
      `
    }

    query += `
      ORDER BY
        CASE WHEN supplier_cd IS NULL OR LTRIM(RTRIM(supplier_cd)) = '' THEN 1 ELSE 0 END,
        supplier_cd,
        name
    `

    const sqlRequest = pool.request()
    if (searchTerm.length > 0) {
      sqlRequest.input("searchTerm", `%${searchTerm}%`)
    }

    const result = await sqlRequest.query(query)

    const data: PurchaseOrderSupplier[] = result.recordset.map((row: Record<string, unknown>) => ({
      supplierCode: typeof row.supplier_cd === "string" ? row.supplier_cd : null,
      supplierName: typeof row.name === "string" ? row.name : null,
    }))

    return NextResponse.json<PurchaseOrderSuppliersResponse>({
      success: true,
      data,
    })
  } catch (error) {
    console.error("PO suppliers query error:", error)

    return NextResponse.json<PurchaseOrderSuppliersResponse>(
      {
        success: false,
        data: [],
        error: "Failed to fetch PO suppliers data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
