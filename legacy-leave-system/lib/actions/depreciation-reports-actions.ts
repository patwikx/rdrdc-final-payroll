"use server";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { AssetStatus, DepreciationMethod } from "@prisma/client";

export interface DepreciationSummaryData {
  totalAssets: number;
  totalPurchaseValue: number;
  totalCurrentBookValue: number;
  totalAccumulatedDepreciation: number;
  totalDepreciationExpense: number;
  fullyDepreciatedAssets: number;
  assetsNearingFullDepreciation: number;
  byCategory: {
    categoryId: string;
    categoryName: string;
    assetCount: number;
    purchaseValue: number;
    currentBookValue: number;
    accumulatedDepreciation: number;
    depreciationRate: number;
  }[];
  byMethod: {
    method: string;
    assetCount: number;
    purchaseValue: number;
    currentBookValue: number;
    accumulatedDepreciation: number;
  }[];
  byDepartment: {
    departmentId: string | null;
    departmentName: string;
    assetCount: number;
    purchaseValue: number;
    currentBookValue: number;
    accumulatedDepreciation: number;
  }[];
  monthlyDepreciationTrend: {
    month: string;
    depreciationAmount: number;
    assetCount: number;
  }[];
}

export interface DepreciationAnalysisData {
  id: string;
  itemCode: string;
  description: string;
  serialNumber: string | null;
  category: {
    id: string;
    name: string;
  };
  department: {
    id: string;
    name: string;
  } | null;
  purchaseDate: Date | null;
  purchasePrice: number | null;
  currentBookValue: number | null;
  accumulatedDepreciation: number;
  salvageValue: number | null;
  depreciationMethod: string | null;
  usefulLifeYears: number | null;
  usefulLifeMonths: number | null;
  monthlyDepreciation: number | null;
  isFullyDepreciated: boolean;
  depreciationStartDate: Date | null;
  lastDepreciationDate: Date | null;
  nextDepreciationDate: Date | null;
  remainingBookValue: number;
  remainingUsefulLife: number;
  depreciationRate: number;
  totalDepreciationToDate: number;
  projectedFullDepreciationDate: Date | null;
  priorDepreciationMonths: number;
  status: string;
  location: string | null;
  currentlyAssignedTo: string | null;
  assignedEmployee: {
    id: string;
    name: string;
    employeeId: string;
  } | null;
}

export interface DepreciationFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  departmentId?: string;
  depreciationMethod?: DepreciationMethod;
  status?: AssetStatus;
  isFullyDepreciated?: boolean;
}

export async function getDepreciationSummary(
  businessUnitId: string,
  filters: DepreciationFilters = {}
): Promise<DepreciationSummaryData> {
  const whereClause = {
    businessUnitId,
    isActive: true,
    ...(filters.categoryId && filters.categoryId !== 'all' && { categoryId: filters.categoryId }),
    ...(filters.departmentId && filters.departmentId !== 'all' && { departmentId: filters.departmentId }),
    ...(filters.depreciationMethod && { depreciationMethod: filters.depreciationMethod }),
    ...(filters.status && { status: filters.status }),
    ...(filters.isFullyDepreciated !== undefined && { isFullyDepreciated: filters.isFullyDepreciated }),
    ...(filters.startDate && { purchaseDate: { gte: filters.startDate } }),
    ...(filters.endDate && { purchaseDate: { lte: filters.endDate } }),
  };

  // Get basic totals
  const assets = await prisma.asset.findMany({
    where: whereClause,
    include: {
      category: true,
      department: true,
    },
  });

  const totalAssets = assets.length;
  const totalPurchaseValue = assets.reduce((sum, asset) => 
    sum.add(asset.purchasePrice || new Decimal(0)), new Decimal(0)
  );
  const totalCurrentBookValue = assets.reduce((sum, asset) => 
    sum.add(asset.currentBookValue || new Decimal(0)), new Decimal(0)
  );
  const totalAccumulatedDepreciation = assets.reduce((sum, asset) => 
    sum.add(asset.accumulatedDepreciation), new Decimal(0)
  );

  // Calculate depreciation expense for the period
  const depreciationExpenseQuery = {
    businessUnitId,
    ...(filters.startDate && filters.endDate && {
      depreciationDate: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    }),
  };

  const depreciationRecords = await prisma.assetDepreciation.findMany({
    where: depreciationExpenseQuery,
  });

  const totalDepreciationExpense = depreciationRecords.reduce((sum, record) => 
    sum.add(record.depreciationAmount), new Decimal(0)
  );

  const fullyDepreciatedAssets = assets.filter(asset => asset.isFullyDepreciated).length;

  // Assets nearing full depreciation (within 6 months)
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  
  const assetsNearingFullDepreciation = assets.filter(asset => {
    if (asset.isFullyDepreciated || !asset.nextDepreciationDate) return false;
    
    const remainingValue = (asset.currentBookValue || new Decimal(0)).sub(asset.salvageValue || new Decimal(0));
    const monthlyDep = asset.monthlyDepreciation || new Decimal(0);
    
    if (monthlyDep.lte(0)) return false;
    
    const monthsToFullDepreciation = remainingValue.div(monthlyDep).toNumber();
    return monthsToFullDepreciation <= 6;
  }).length;

  // Group by category
  const categoryGroups = new Map<string, {
    categoryId: string;
    categoryName: string;
    assets: typeof assets;
  }>();

  assets.forEach(asset => {
    const key = asset.categoryId;
    if (!categoryGroups.has(key)) {
      categoryGroups.set(key, {
        categoryId: asset.categoryId,
        categoryName: asset.category.name,
        assets: [],
      });
    }
    categoryGroups.get(key)!.assets.push(asset);
  });

  const byCategory = Array.from(categoryGroups.values()).map(group => {
    const purchaseValue = group.assets.reduce((sum, asset) => 
      sum.add(asset.purchasePrice || new Decimal(0)), new Decimal(0)
    );
    const currentBookValue = group.assets.reduce((sum, asset) => 
      sum.add(asset.currentBookValue || new Decimal(0)), new Decimal(0)
    );
    const accumulatedDepreciation = group.assets.reduce((sum, asset) => 
      sum.add(asset.accumulatedDepreciation), new Decimal(0)
    );
    
    const depreciationRate = purchaseValue.gt(0) 
      ? accumulatedDepreciation.div(purchaseValue).mul(100).toNumber()
      : 0;

    return {
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      assetCount: group.assets.length,
      purchaseValue,
      currentBookValue,
      accumulatedDepreciation,
      depreciationRate,
    };
  });

  // Group by method
  const methodGroups = new Map<string, typeof assets>();
  assets.forEach(asset => {
    const method = asset.depreciationMethod || 'NONE';
    if (!methodGroups.has(method)) {
      methodGroups.set(method, []);
    }
    methodGroups.get(method)!.push(asset);
  });

  const byMethod = Array.from(methodGroups.entries()).map(([method, methodAssets]) => {
    const purchaseValue = methodAssets.reduce((sum, asset) => 
      sum.add(asset.purchasePrice || new Decimal(0)), new Decimal(0)
    );
    const currentBookValue = methodAssets.reduce((sum, asset) => 
      sum.add(asset.currentBookValue || new Decimal(0)), new Decimal(0)
    );
    const accumulatedDepreciation = methodAssets.reduce((sum, asset) => 
      sum.add(asset.accumulatedDepreciation), new Decimal(0)
    );

    return {
      method,
      assetCount: methodAssets.length,
      purchaseValue,
      currentBookValue,
      accumulatedDepreciation,
    };
  });

  // Group by department
  const departmentGroups = new Map<string, {
    departmentId: string | null;
    departmentName: string;
    assets: typeof assets;
  }>();

  assets.forEach(asset => {
    const key = asset.departmentId || 'unassigned';
    if (!departmentGroups.has(key)) {
      departmentGroups.set(key, {
        departmentId: asset.departmentId,
        departmentName: asset.department?.name || 'Unassigned',
        assets: [],
      });
    }
    departmentGroups.get(key)!.assets.push(asset);
  });

  const byDepartment = Array.from(departmentGroups.values()).map(group => {
    const purchaseValue = group.assets.reduce((sum, asset) => 
      sum.add(asset.purchasePrice || new Decimal(0)), new Decimal(0)
    );
    const currentBookValue = group.assets.reduce((sum, asset) => 
      sum.add(asset.currentBookValue || new Decimal(0)), new Decimal(0)
    );
    const accumulatedDepreciation = group.assets.reduce((sum, asset) => 
      sum.add(asset.accumulatedDepreciation), new Decimal(0)
    );

    return {
      departmentId: group.departmentId,
      departmentName: group.departmentName,
      assetCount: group.assets.length,
      purchaseValue,
      currentBookValue,
      accumulatedDepreciation,
    };
  });

  // Monthly depreciation trend (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const monthlyDepreciation = await prisma.assetDepreciation.groupBy({
    by: ['depreciationDate'],
    where: {
      businessUnitId,
      depreciationDate: {
        gte: twelveMonthsAgo,
      },
    },
    _sum: {
      depreciationAmount: true,
    },
    _count: {
      id: true,
    },
  });

  const monthlyDepreciationTrend = monthlyDepreciation.map(record => ({
    month: record.depreciationDate.toISOString().substring(0, 7), // YYYY-MM format
    depreciationAmount: record._sum.depreciationAmount || new Decimal(0),
    assetCount: record._count.id,
  }));

  return {
    totalAssets,
    totalPurchaseValue: totalPurchaseValue.toNumber(),
    totalCurrentBookValue: totalCurrentBookValue.toNumber(),
    totalAccumulatedDepreciation: totalAccumulatedDepreciation.toNumber(),
    totalDepreciationExpense: totalDepreciationExpense.toNumber(),
    fullyDepreciatedAssets,
    assetsNearingFullDepreciation,
    byCategory: byCategory.map(cat => ({
      ...cat,
      purchaseValue: cat.purchaseValue.toNumber(),
      currentBookValue: cat.currentBookValue.toNumber(),
      accumulatedDepreciation: cat.accumulatedDepreciation.toNumber(),
    })),
    byMethod: byMethod.map(method => ({
      ...method,
      purchaseValue: method.purchaseValue.toNumber(),
      currentBookValue: method.currentBookValue.toNumber(),
      accumulatedDepreciation: method.accumulatedDepreciation.toNumber(),
    })),
    byDepartment: byDepartment.map(dept => ({
      ...dept,
      purchaseValue: dept.purchaseValue.toNumber(),
      currentBookValue: dept.currentBookValue.toNumber(),
      accumulatedDepreciation: dept.accumulatedDepreciation.toNumber(),
    })),
    monthlyDepreciationTrend: monthlyDepreciationTrend.map(trend => ({
      ...trend,
      depreciationAmount: trend.depreciationAmount.toNumber(),
    })),
  };
}

export async function getDepreciationAnalysis(
  businessUnitId: string,
  filters: DepreciationFilters = {}
): Promise<DepreciationAnalysisData[]> {
  const whereClause = {
    businessUnitId,
    isActive: true,
    ...(filters.categoryId && filters.categoryId !== 'all' && { categoryId: filters.categoryId }),
    ...(filters.departmentId && filters.departmentId !== 'all' && { departmentId: filters.departmentId }),
    ...(filters.depreciationMethod && { depreciationMethod: filters.depreciationMethod }),
    ...(filters.status && { status: filters.status }),
    ...(filters.isFullyDepreciated !== undefined && { isFullyDepreciated: filters.isFullyDepreciated }),
    ...(filters.startDate && { purchaseDate: { gte: filters.startDate } }),
    ...(filters.endDate && { purchaseDate: { lte: filters.endDate } }),
  };

  const assets = await prisma.asset.findMany({
    where: whereClause,
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      deployments: {
        where: {
          status: 'DEPLOYED',
          returnedDate: null,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
        },
        take: 1,
      },
    },
    orderBy: [
      { category: { name: 'asc' } },
      { description: 'asc' },
    ],
  });

  return assets.map(asset => {
    const purchasePrice = asset.purchasePrice || new Decimal(0);
    const currentBookValue = asset.currentBookValue || new Decimal(0);
    const salvageValue = asset.salvageValue || new Decimal(0);
    const accumulatedDepreciation = asset.accumulatedDepreciation;
    
    const remainingBookValue = currentBookValue.sub(salvageValue);
    const totalDepreciationToDate = purchasePrice.sub(currentBookValue);
    
    // Calculate remaining useful life
    let remainingUsefulLife = 0;
    if (asset.monthlyDepreciation && asset.monthlyDepreciation.gt(0) && !asset.isFullyDepreciated) {
      remainingUsefulLife = Math.ceil(remainingBookValue.div(asset.monthlyDepreciation).toNumber());
    }
    
    // Calculate depreciation rate
    const depreciationRate = purchasePrice.gt(0) 
      ? accumulatedDepreciation.div(purchasePrice).mul(100).toNumber()
      : 0;
    
    // Calculate projected full depreciation date
    let projectedFullDepreciationDate: Date | null = null;
    if (asset.nextDepreciationDate && asset.monthlyDepreciation && asset.monthlyDepreciation.gt(0) && !asset.isFullyDepreciated) {
      const monthsRemaining = remainingUsefulLife;
      projectedFullDepreciationDate = new Date(asset.nextDepreciationDate);
      projectedFullDepreciationDate.setMonth(projectedFullDepreciationDate.getMonth() + monthsRemaining);
    }

    const currentDeployment = asset.deployments[0];
    const assignedEmployee = currentDeployment?.employee || null;

    return {
      id: asset.id,
      itemCode: asset.itemCode,
      description: asset.description,
      serialNumber: asset.serialNumber,
      category: asset.category,
      department: asset.department,
      purchaseDate: asset.purchaseDate,
      purchasePrice: purchasePrice.toNumber(),
      currentBookValue: currentBookValue.toNumber(),
      accumulatedDepreciation: accumulatedDepreciation.toNumber(),
      salvageValue: salvageValue.toNumber(),
      depreciationMethod: asset.depreciationMethod,
      usefulLifeYears: asset.usefulLifeYears,
      usefulLifeMonths: asset.usefulLifeMonths,
      monthlyDepreciation: asset.monthlyDepreciation?.toNumber() || null,
      isFullyDepreciated: asset.isFullyDepreciated,
      depreciationStartDate: asset.depreciationStartDate,
      lastDepreciationDate: asset.lastDepreciationDate,
      nextDepreciationDate: asset.nextDepreciationDate,
      remainingBookValue: remainingBookValue.toNumber(),
      remainingUsefulLife,
      depreciationRate,
      totalDepreciationToDate: totalDepreciationToDate.toNumber(),
      projectedFullDepreciationDate,
      priorDepreciationMonths: asset.priorDepreciationMonths,
      status: asset.status,
      location: asset.location,
      currentlyAssignedTo: asset.currentlyAssignedTo,
      assignedEmployee,
    };
  });
}

export async function getDepreciationFilterOptions(businessUnitId: string) {
  const [categories, departments] = await Promise.all([
    prisma.assetCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { businessUnitId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const depreciationMethods = [
    { value: 'STRAIGHT_LINE', label: 'Straight Line' },
    { value: 'DECLINING_BALANCE', label: 'Declining Balance' },
    { value: 'UNITS_OF_PRODUCTION', label: 'Units of Production' },
    { value: 'SUM_OF_YEARS_DIGITS', label: 'Sum of Years Digits' },
  ];

  const assetStatuses = [
    { value: 'AVAILABLE', label: 'Available' },
    { value: 'DEPLOYED', label: 'Deployed' },
    { value: 'IN_MAINTENANCE', label: 'In Maintenance' },
    { value: 'RETIRED', label: 'Retired' },
    { value: 'FULLY_DEPRECIATED', label: 'Fully Depreciated' },
    { value: 'DISPOSED', label: 'Disposed' },
  ];

  return {
    categories,
    departments,
    depreciationMethods,
    assetStatuses,
  };
}