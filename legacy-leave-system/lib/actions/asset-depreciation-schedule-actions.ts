"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export interface DepreciationScheduleEntry {
  period: number;
  date: Date;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValue: number;
  isCompleted: boolean;
}

export async function getAssetDepreciationSchedule(
  assetId: string,
  businessUnitId: string
): Promise<DepreciationScheduleEntry[]> {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  // Check user access to business unit
  // Check user access - Admins and Accounting users can access any business unit
  if (session.user.role !== "ADMIN" && !session.user.isAcctg) {
    if (!session.user.businessUnit?.id || session.user.businessUnit.id !== businessUnitId) {
      throw new Error("Access denied to this business unit");
    }
  }


  // Get asset details
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      businessUnitId: businessUnitId
    },
    select: {
      id: true,
      purchasePrice: true,
      salvageValue: true,
      currentBookValue: true,
      accumulatedDepreciation: true,
      monthlyDepreciation: true,
      usefulLifeYears: true,
      usefulLifeMonths: true,
      depreciationStartDate: true,
      depreciationMethod: true,
      isFullyDepreciated: true
    }
  });

  if (!asset) {
    throw new Error("Asset not found");
  }

  if (!asset.purchasePrice || !asset.depreciationStartDate || !asset.monthlyDepreciation) {
    return [];
  }

  // Calculate total useful life in months
  // Handle both old format (years + months) and new format (total months)
  let totalMonths = 0;
  
  if (asset.usefulLifeMonths && asset.usefulLifeMonths > 12) {
    // New format: total months stored in usefulLifeMonths
    totalMonths = asset.usefulLifeMonths;
  } else {
    // Old format: years * 12 + additional months
    totalMonths = (asset.usefulLifeYears || 0) * 12 + (asset.usefulLifeMonths || 0);
  }
  
  if (totalMonths === 0) {
    return [];
  }

  // Get existing depreciation history to determine completed periods
  const existingDepreciation = await prisma.assetDepreciation.findMany({
    where: {
      assetId: assetId
    },
    orderBy: {
      depreciationDate: 'asc'
    }
  });

  const schedule: DepreciationScheduleEntry[] = [];
  const startDate = new Date(asset.depreciationStartDate);
  const purchasePrice = Number(asset.purchasePrice);
  const salvageValue = Number(asset.salvageValue || 0);
  const monthlyDep = Number(asset.monthlyDepreciation);
  
  let currentBookValue = purchasePrice;
  let accumulatedDep = 0;

  // If there's existing depreciation, start from current values
  if (existingDepreciation.length > 0) {
    currentBookValue = Number(asset.currentBookValue || purchasePrice);
    accumulatedDep = Number(asset.accumulatedDepreciation || 0);
  }

  for (let period = 1; period <= totalMonths; period++) {
    const periodDate = new Date(startDate);
    periodDate.setMonth(startDate.getMonth() + period - 1);
    
    // Check if this period has already been depreciated
    const isCompleted = existingDepreciation.some((dep: any) => {
      const depDate = new Date(dep.depreciationDate);
      return depDate.getFullYear() === periodDate.getFullYear() && 
             depDate.getMonth() === periodDate.getMonth();
    });

    let depreciationAmount = monthlyDep;
    
    // Adjust for final period to not exceed salvage value
    if (currentBookValue - depreciationAmount < salvageValue) {
      depreciationAmount = Math.max(0, currentBookValue - salvageValue);
    }

    if (!isCompleted) {
      // For future periods, calculate from current state
      accumulatedDep += depreciationAmount;
      currentBookValue -= depreciationAmount;
    }

    schedule.push({
      period,
      date: periodDate,
      depreciationAmount,
      accumulatedDepreciation: accumulatedDep,
      bookValue: currentBookValue,
      isCompleted
    });

    // Stop if fully depreciated
    if (currentBookValue <= salvageValue) {
      break;
    }
  }

  return schedule;
}