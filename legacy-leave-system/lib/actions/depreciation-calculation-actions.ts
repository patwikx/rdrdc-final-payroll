"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export interface AssetForDepreciation {
  id: string;
  itemCode: string;
  description: string;
  brand?: string;
  category: {
    id: string;
    name: string;
  };
  purchasePrice: number;
  currentBookValue: number;
  accumulatedDepreciation: number;
  monthlyDepreciation: number;
  nextDepreciationDate: Date;
  depreciationMethod: string;
  isFullyDepreciated: boolean;
  usefulLifeYears?: number;
  usefulLifeMonths?: number;
  salvageValue: number;
}

export interface DepreciationCalculationData {
  assets: AssetForDepreciation[];
  nextMonthAssets?: AssetForDepreciation[];
  summary: {
    totalAssets: number;
    totalMonthlyDepreciation: number;
    totalCurrentBookValue: number;
    canCalculate: boolean;
    isEndOfMonth: boolean;
    currentDate: Date;
    nextAllowedDate?: Date;
    nextMonthAssetsCount?: number;
    nextMonthTotalDepreciation?: number;
  };
  categories: Array<{
    id: string;
    name: string;
    count: number;
  }>;
}

export async function getAssetsForDepreciation(
  businessUnitId: string,
  override: boolean = false
): Promise<DepreciationCalculationData> {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  // Check user permissions
  if (session.user.role !== "ADMIN" && session.user.role !== "ACCTG") {
    throw new Error("Access denied. Only ADMIN and ACCTG roles can calculate depreciation.");
  }

  // Check if it's end of month (30th or 31st) or if override is allowed
  const today = new Date();
  const currentDay = today.getDate();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const isEndOfMonth = currentDay === 30 || currentDay === 31 || currentDay === lastDayOfMonth;
  
  const canCalculate = isEndOfMonth || (override && session.user.role === "ADMIN");

  // Get next allowed date (next 30th)
  let nextAllowedDate: Date | undefined;
  if (!canCalculate) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 30);
    nextAllowedDate = nextMonth;
  }

  // Get assets that need depreciation
  const assets = await prisma.asset.findMany({
    where: {
      businessUnitId: businessUnitId,
      isActive: true,
      isFullyDepreciated: false,
      monthlyDepreciation: {
        gt: 0
      },
      nextDepreciationDate: {
        lte: new Date() // Due for depreciation
      }
    },
    include: {
      category: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [
      { nextDepreciationDate: 'asc' },
      { itemCode: 'asc' }
    ]
  });

  // Get category summary
  const categoryStats = await prisma.asset.groupBy({
    by: ['categoryId'],
    where: {
      businessUnitId: businessUnitId,
      isActive: true,
      isFullyDepreciated: false,
      monthlyDepreciation: {
        gt: 0
      },
      nextDepreciationDate: {
        lte: new Date()
      }
    },
    _count: {
      id: true
    }
  });

  const categories = await Promise.all(
    categoryStats.map(async (stat) => {
      const category = await prisma.assetCategory.findUnique({
        where: { id: stat.categoryId },
        select: { id: true, name: true }
      });
      return {
        id: stat.categoryId,
        name: category?.name || 'Unknown',
        count: stat._count.id
      };
    })
  );

  // Calculate summary
  const totalMonthlyDepreciation = assets.reduce(
    (sum, asset) => sum + Number(asset.monthlyDepreciation || 0), 
    0
  );
  
  const totalCurrentBookValue = assets.reduce(
    (sum, asset) => sum + Number(asset.currentBookValue || 0), 
    0
  );

  // If no assets due this month, fetch next month's assets for preview
  let nextMonthAssets: AssetForDepreciation[] | undefined;
  let nextMonthAssetsCount: number | undefined;
  let nextMonthTotalDepreciation: number | undefined;

  if (assets.length === 0) {
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const nextMonthAssetsData = await prisma.asset.findMany({
      where: {
        businessUnitId: businessUnitId,
        isActive: true,
        isFullyDepreciated: false,
        monthlyDepreciation: {
          gt: 0
        },
        nextDepreciationDate: {
          gte: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1),
          lt: new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1)
        }
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { nextDepreciationDate: 'asc' },
        { itemCode: 'asc' }
      ],
      take: 50 // Limit for preview
    });

    nextMonthAssets = nextMonthAssetsData.map(asset => ({
      id: asset.id,
      itemCode: asset.itemCode,
      description: asset.description,
      brand: asset.brand || undefined,
      category: {
        id: asset.category.id,
        name: asset.category.name
      },
      purchasePrice: Number(asset.purchasePrice || 0),
      currentBookValue: Number(asset.currentBookValue || 0),
      accumulatedDepreciation: Number(asset.accumulatedDepreciation || 0),
      monthlyDepreciation: Number(asset.monthlyDepreciation || 0),
      nextDepreciationDate: asset.nextDepreciationDate!,
      depreciationMethod: asset.depreciationMethod || 'STRAIGHT_LINE',
      isFullyDepreciated: asset.isFullyDepreciated,
      usefulLifeYears: asset.usefulLifeYears || undefined,
      usefulLifeMonths: asset.usefulLifeMonths || undefined,
      salvageValue: Number(asset.salvageValue || 0)
    }));

    nextMonthAssetsCount = nextMonthAssetsData.length;
    nextMonthTotalDepreciation = nextMonthAssets.reduce(
      (sum, asset) => sum + asset.monthlyDepreciation, 
      0
    );
  }

  return {
    assets: assets.map(asset => ({
      id: asset.id,
      itemCode: asset.itemCode,
      description: asset.description,
      brand: asset.brand || undefined,
      category: {
        id: asset.category.id,
        name: asset.category.name
      },
      purchasePrice: Number(asset.purchasePrice || 0),
      currentBookValue: Number(asset.currentBookValue || 0),
      accumulatedDepreciation: Number(asset.accumulatedDepreciation || 0),
      monthlyDepreciation: Number(asset.monthlyDepreciation || 0),
      nextDepreciationDate: asset.nextDepreciationDate!,
      depreciationMethod: asset.depreciationMethod || 'STRAIGHT_LINE',
      isFullyDepreciated: asset.isFullyDepreciated,
      usefulLifeYears: asset.usefulLifeYears || undefined,
      usefulLifeMonths: asset.usefulLifeMonths || undefined,
      salvageValue: Number(asset.salvageValue || 0)
    })),
    nextMonthAssets,
    summary: {
      totalAssets: assets.length,
      totalMonthlyDepreciation,
      totalCurrentBookValue,
      canCalculate,
      isEndOfMonth,
      currentDate: today,
      nextAllowedDate,
      nextMonthAssetsCount,
      nextMonthTotalDepreciation
    },
    categories
  };
}

export async function calculateDepreciationBatch(
  businessUnitId: string,
  assetIds: string[],
  override: boolean = false
): Promise<{
  success: boolean;
  processedCount: number;
  failedCount: number;
  totalDepreciation: number;
  errors: string[];
}> {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // Check user permissions
  if (session.user.role !== "ADMIN" && session.user.role !== "ACCTG") {
    throw new Error("Access denied. Only ADMIN and ACCTG roles can calculate depreciation.");
  }

  // Check date restrictions
  const today = new Date();
  const currentDay = today.getDate();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const isEndOfMonth = currentDay === 30 || currentDay === 31 || currentDay === lastDayOfMonth;
  
  if (!isEndOfMonth && !(override && session.user.role === "ADMIN")) {
    throw new Error("Depreciation can only be calculated on the 30th or 31st of the month, or with admin override.");
  }

  let processedCount = 0;
  let failedCount = 0;
  let totalDepreciation = 0;
  const errors: string[] = [];

  // Process each asset
  for (const assetId of assetIds) {
    try {
      const asset = await prisma.asset.findUnique({
        where: { 
          id: assetId,
          businessUnitId: businessUnitId
        }
      });

      if (!asset) {
        errors.push(`Asset ${assetId} not found`);
        failedCount++;
        continue;
      }

      if (asset.isFullyDepreciated) {
        errors.push(`Asset ${asset.itemCode} is already fully depreciated`);
        failedCount++;
        continue;
      }

      if (!asset.monthlyDepreciation || Number(asset.monthlyDepreciation) <= 0) {
        errors.push(`Asset ${asset.itemCode} has no monthly depreciation set`);
        failedCount++;
        continue;
      }

      const currentBookValue = Number(asset.currentBookValue || asset.purchasePrice || 0);
      const monthlyDepreciation = Number(asset.monthlyDepreciation);
      const salvageValue = Number(asset.salvageValue || 0);
      const accumulatedDepreciation = Number(asset.accumulatedDepreciation || 0);

      // Calculate new values
      let depreciationAmount = monthlyDepreciation;
      
      // Don't depreciate below salvage value
      if (currentBookValue - depreciationAmount < salvageValue) {
        depreciationAmount = Math.max(0, currentBookValue - salvageValue);
      }

      if (depreciationAmount <= 0) {
        errors.push(`Asset ${asset.itemCode} cannot be depreciated further (at salvage value)`);
        failedCount++;
        continue;
      }

      const newBookValue = currentBookValue - depreciationAmount;
      const newAccumulatedDepreciation = accumulatedDepreciation + depreciationAmount;
      const isNowFullyDepreciated = newBookValue <= salvageValue;

      // Calculate next depreciation date (next month, same day)
      const nextDepreciationDate = new Date(today);
      nextDepreciationDate.setMonth(nextDepreciationDate.getMonth() + 1);

      // Create depreciation record
      await prisma.assetDepreciation.create({
        data: {
          assetId: asset.id,
          businessUnitId: businessUnitId,
          depreciationDate: today,
          periodStartDate: asset.lastDepreciationDate || asset.depreciationStartDate || today,
          periodEndDate: today,
          bookValueStart: currentBookValue,
          depreciationAmount: depreciationAmount,
          bookValueEnd: newBookValue,
          accumulatedDepreciation: newAccumulatedDepreciation,
          method: asset.depreciationMethod || 'STRAIGHT_LINE',
          calculatedBy: session.user.id,
          notes: override ? 'Manual calculation with admin override' : 'Automated monthly calculation'
        }
      });

      // Update asset
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          currentBookValue: newBookValue,
          accumulatedDepreciation: newAccumulatedDepreciation,
          lastDepreciationDate: today,
          nextDepreciationDate: isNowFullyDepreciated ? null : nextDepreciationDate,
          isFullyDepreciated: isNowFullyDepreciated
        }
      });

      // Create history record
      await prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: 'DEPRECIATION_CALCULATED',
          previousBookValue: currentBookValue,
          newBookValue: newBookValue,
          depreciationAmount: depreciationAmount,
          notes: `Monthly depreciation calculated: ${depreciationAmount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}`,
          performedById: session.user.id,
          businessUnitId: businessUnitId
        }
      });

      processedCount++;
      totalDepreciation += depreciationAmount;

    } catch (error) {
      console.error(`Error processing asset ${assetId}:`, error);
      errors.push(`Error processing asset ${assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failedCount++;
    }
  }

  return {
    success: processedCount > 0,
    processedCount,
    failedCount,
    totalDepreciation,
    errors
  };
}