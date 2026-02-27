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

// Excluded item codes
const EXCLUDED_ITEM_CODES = [
  'ADRS1', 'CHB0001', 'CHB0002', 'ESPS1', 'ESPS2', 'ESPS3', 'ESPS4', 'ESPS5', 'ESPS6', 'ESPS7', 'ESPS8', 'ESPS9',
  'FG001', 'FOLF1', 'FOLF2', 'FOLF3', 'FOLF4', 'FOLF5', 'FOLF6', 'FOLL1', 'FOLL2', 'FOLL3', 'FOLL4',
  'FOLO1', 'FOLO2', 'FOLO3', 'FOLO4', 'FOLO5', 'FOLO6', 'FOLO7', 'INSU1', 'INSU2', 'INSU3', 'IPIP10',
  'MEDS013', 'MEDS1', 'MEDS10', 'MEDS11', 'MEDS12', 'MEDS2', 'MEDS3', 'MEDS4', 'MEDS5', 'MEDS6', 'MEDS7', 'MEDS8', 'MEDS9',
  'MNTM01', 'MNTM02', 'MNTM03', 'MNTM04', 'MNTM05', 'MNTM06', 'MNTM07', 'MNTM08', 'MNTM09', 'MNTM10', 'MNTM11', 'MNTM12', 'MNTM13',
  'MNTP14', 'MNTP15', 'MNTS16', 'MNTS17', 'MNTS18', 'MNTS19', 'MNTS20', 'MNTS21', 'MNTS22', 'MNTS23',
  'OFS066', 'OFS073', 'OFSC001', 'OFSE002', 'OFSE003', 'OFSE004', 'OFSE005', 'OFSE006', 'OFSE007', 'OFSE008', 'OFSE009', 'OFSE010',
  'OFSE011', 'OFSE012', 'OFSE013', 'OFSE014', 'OFSE050', 'OFSF013', 'OFSF014', 'OFSF015', 'OFSF016', 'OFSF017', 'OFSF018', 'OFSF019',
  'OFSF020', 'OFSF021', 'OFSF022', 'OFSF023', 'OFSF024', 'OFSF025', 'OFSF026', 'OFSF027', 'OFSF028', 'OFSF029', 'OFSF030', 'OFSF031',
  'OFSF032', 'OFSF033', 'OFSF034', 'OFSF035', 'OFSF036', 'OFSF037', 'OFSF038', 'OFSF039', 'OFSF040', 'OFSF041', 'OFSF042', 'OFSF043',
  'OFSF044', 'OFSF045', 'OFSF046', 'OFSF047', 'OFSF048', 'OFSF049', 'OFSF050', 'OFSF051', 'OFSF052', 'OFSF053', 'OFSF054', 'OFSF055',
  'OFSF056', 'OFSF057', 'OFSF058', 'OFSF059', 'OFSF060', 'OFSF061', 'OFSF062', 'OFSF063', 'OFSF064', 'OFSF065', 'OFSF066', 'OFSF163',
  'OFSF164', 'OFSF165', 'OFSI066', 'OFSI067', 'OFSI068', 'OFSI069', 'OFSI070', 'OFSI071', 'OFSI072', 'OFSI073', 'OFSI074', 'OFSO001',
  'OFSO0126', 'OFSO0127', 'OFSO0128', 'OFSO0135', 'OFSO074', 'OFSO075', 'OFSO076', 'OFSO077', 'OFSO078', 'OFSO079', 'OFSO080', 'OFSO081',
  'OFSO082', 'OFSO083', 'OFSO084', 'OFSO085', 'OFSO086', 'OFSO087', 'OFSO088', 'OFSO089', 'OFSO090', 'OFSO091', 'OFSO092', 'OFSO093',
  'OFSO094', 'OFSO095', 'OFSO096', 'OFSO097', 'OFSO098', 'OFSO099', 'OFSO100', 'OFSO101', 'OFSO102', 'OFSO103', 'OFSO104', 'OFSO105',
  'OFSO106', 'OFSO107', 'OFSO108', 'OFSO109', 'OFSO110', 'OFSO111', 'OFSO112', 'OFSO113', 'OFSO114', 'OFSO115', 'OFSO116', 'OFSO117',
  'OFSO118', 'OFSO119', 'OFSO120', 'OFSO121', 'OFSO122', 'OFSO123', 'OFSO124', 'OFSO125', 'OFSO126', 'OFSO127', 'OFSO128', 'OFSO129',
  'OFSO130', 'OFSO131', 'OFSO132', 'OFSO133', 'OFSO134', 'OFSO231', 'OFSP126', 'OFSP127', 'OFSP128', 'OFSP129', 'OFSP130', 'OFSP131',
  'OFSP132', 'OFSP133', 'OFSP134', 'OFSP135', 'OFSP136', 'OFSP137', 'OFSP138', 'OFSP139', 'OFSP140', 'OFSP141', 'OFSP142', 'OFSP143',
  'OFSP144', 'OFSP145', 'OFSP146', 'OFSP147', 'OFSR147', 'OFSR148', 'OFSR149', 'OFSR150', 'OFSR151', 'OFSR152', 'OFST153', 'OFST154',
  'TCKT1', 'TSEQ1', 'Z-0001', 'Z-0002', 'Z-0003', 'Z-0004', 'Z-0005', 'Z-0006', 'Z-0007', 'Z-0008'
];

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
      WHERE "ItemCode" NOT IN (${EXCLUDED_ITEM_CODES.map((_, i) => `@excluded${i}`).join(', ')})
    `;

    // Add optional search filter
    if (searchTerm) {
      query += ` AND ("ItemCode" LIKE @searchTerm OR "ItemDesc" LIKE @searchTerm)`;
    }

    query += ` ORDER BY "ItemCode"`;

    const request_query = pool.request();
    
    // Add excluded item codes as parameters
    EXCLUDED_ITEM_CODES.forEach((code, i) => {
      request_query.input(`excluded${i}`, code);
    });
    
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