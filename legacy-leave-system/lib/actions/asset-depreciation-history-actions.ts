"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface AssetDepreciationRecord {
  id: string;
  depreciationDate: Date;
  periodStartDate: Date;
  periodEndDate: Date;
  bookValueStart: number;
  depreciationAmount: number;
  bookValueEnd: number;
  accumulatedDepreciation: number;
  method: string;
  isAdjustment: boolean;
  adjustmentReason: string | null;
  notes: string | null;
  calculatedBy: string | null;
  calculatedAt: Date;
}

// Check if user has access to business unit
async function checkBusinessUnitAccess(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  // Admins and ACCTG can access any business unit
  if (session.user.role === "ADMIN" || session.user.role === "ACCTG") {
    return session.user;
  }
  
  // Regular users can only access their own business unit
  if (!session.user.businessUnit?.id) {
    throw new Error("User not assigned to any business unit");
  }
  
  if (session.user.businessUnit.id !== businessUnitId) {
    throw new Error(`Access denied: User business unit ${session.user.businessUnit.id} does not match requested ${businessUnitId}`);
  }
  
  return session.user;
}

// Get depreciation history for a specific asset
export async function getAssetDepreciationHistory(
  assetId: string,
  businessUnitId: string
): Promise<AssetDepreciationRecord[]> {
  try {
    await checkBusinessUnitAccess(businessUnitId);

    // Verify asset belongs to the business unit
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        businessUnitId,
      },
      select: { id: true },
    });

    if (!asset) {
      throw new Error("Asset not found or access denied");
    }

    const depreciationRecords = await prisma.assetDepreciation.findMany({
      where: {
        assetId,
      },
      orderBy: {
        depreciationDate: 'desc',
      },
    });

    return depreciationRecords.map(record => ({
      id: record.id,
      depreciationDate: record.depreciationDate,
      periodStartDate: record.periodStartDate,
      periodEndDate: record.periodEndDate,
      bookValueStart: Number(record.bookValueStart),
      depreciationAmount: Number(record.depreciationAmount),
      bookValueEnd: Number(record.bookValueEnd),
      accumulatedDepreciation: Number(record.accumulatedDepreciation),
      method: record.method,
      isAdjustment: record.isAdjustment,
      adjustmentReason: record.adjustmentReason,
      notes: record.notes,
      calculatedBy: record.calculatedBy,
      calculatedAt: record.calculatedAt,
    }));
  } catch (error) {
    console.error("Error fetching asset depreciation history:", error);
    throw error;
  }
}