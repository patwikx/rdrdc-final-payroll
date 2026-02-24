import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database';

export interface Supplier {
  cardCode: string;
  cardName: string;
}

export interface SuppliersResponse {
  success: boolean;
  data: Supplier[];
  error?: string;
  details?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search'); // Optional search parameter

    const pool = await getConnection();

    let query = `
      SELECT 
        "CardCode", 
        "CardName"
      FROM "RD_REALTY_LIVE"."dbo"."OCRD"
      WHERE "CardType" = 'S' AND "CardCode" LIKE '%VTPT%'
    `;

    // Add optional search filter
    if (searchTerm) {
      query += ` AND ("CardCode" LIKE @searchTerm OR "CardName" LIKE @searchTerm)`;
    }

    query += `
      ORDER BY "CardCode"
    `;

    const request_query = pool.request();
    
    if (searchTerm) {
      request_query.input('searchTerm', `%${searchTerm}%`);
    }

    const result = await request_query.query(query);

    const transformedData: Supplier[] = result.recordset.map((row: Record<string, unknown>) => ({
      cardCode: row.CardCode as string,
      cardName: row.CardName as string,
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error('Suppliers query error:', error);
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: 'Failed to fetch suppliers data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}