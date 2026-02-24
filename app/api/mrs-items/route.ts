import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database';

export interface MRSItem {
  itemId: string;
  itemCode: string;
  itemDesc: string;
  buyUnitMsr: string | null;
  purPackMsr: string | null;
  cost: number;
}

export interface MRSItemsResponse {
  success: boolean;
  data: MRSItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
  details?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search'); // Optional search parameter
    
    const pool = await getConnection('db2');
    
    let query = `
      SELECT 
        "ItemId", 
        "ItemCode", 
        "ItemDesc", 
        "BuyUnitMsr", 
        "PurPackMsr", 
        "Cost"
      FROM [RD Realty].[dbo].[OITM]
    `;

    // Add optional search filter
    if (searchTerm) {
      query += ` WHERE ("ItemCode" LIKE @searchTerm OR "ItemDesc" LIKE @searchTerm)`;
    }

    query += ` ORDER BY "ItemCode"`;

    const request_query = pool.request();
    
    if (searchTerm) {
      request_query.input('searchTerm', `%${searchTerm}%`);
    }

    const result = await request_query.query(query);

    const transformedData: MRSItem[] = result.recordset.map((row: Record<string, unknown>) => ({
      itemId: row.ItemId as string,
      itemCode: row.ItemCode as string,
      itemDesc: row.ItemDesc as string,
      buyUnitMsr: row.BuyUnitMsr as string | null,
      purPackMsr: row.PurPackMsr as string | null,
      cost: row.Cost as number,
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
    });

  } catch (error) {
    console.error('MRS Items query error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      error: 'Failed to fetch MRS items data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}