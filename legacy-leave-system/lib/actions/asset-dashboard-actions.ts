"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AssetStatus, DeploymentStatus, AssetDisposalReason, AssetRetirementReason } from "@prisma/client";

// Types for asset dashboard data
export interface AssetDashboardStats {
  totalAssets: number;
  activeAssets: number;
  deployedAssets: number;
  availableAssets: number;
  maintenanceAssets: number;
  retiredAssets: number;
  totalValue: number;
  depreciatedValue: number;
  pendingDeployments: number;
  pendingReturns: number;
  categoriesCount: number;
  departmentsCount: number;
}

export interface AssetStatusDistribution {
  status: AssetStatus;
  count: number;
  percentage: number;
}

export interface AssetCategoryStats {
  id: string;
  name: string;
  code: string;
  count: number;
  totalValue: number;
  averageValue: number;
}

export interface RecentAssetActivity {
  id: string;
  action: string;
  assetCode: string;
  assetDescription: string;
  performedBy: string;
  performedAt: Date;
  notes: string | null;
}

export interface DepreciationSummary {
  totalOriginalValue: number;
  totalCurrentValue: number;
  totalDepreciation: number;
  depreciationRate: number;
  monthlyDepreciation: number;
}

export interface DeploymentStats {
  totalDeployments: number;
  activeDeployments: number;
  pendingApproval: number;
  pendingReturn: number;
  topDepartments: Array<{
    departmentName: string;
    count: number;
  }>;
}

export interface AssetTrends {
  month: string;
  newAssets: number;
  deployments: number;
  returns: number;
  disposals: number;
}

// Check if user has access to business unit and asset management
async function checkAssetManagementAccess(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  // Only ADMIN and users with isAcctg flag can access asset management
  if (session.user.role !== "ADMIN" && !session.user.isAcctg) {
    throw new Error("Access denied: Insufficient permissions for asset management");
  }
  
  // Admins and Accounting users can access any business unit
  // No business unit restriction for these roles
  
  return session.user;
}

// Get asset dashboard statistics
export async function getAssetDashboardStats(businessUnitId: string): Promise<AssetDashboardStats> {
  try {
    await checkAssetManagementAccess(businessUnitId);
    
    const [
      totalAssets,
      activeAssets,
      deployedAssets,
      availableAssets,
      maintenanceAssets,
      retiredAssets,
      totalValue,
      depreciatedValue,
      pendingDeployments,
      pendingReturns,
      categoriesCount,
      departmentsCount,
    ] = await Promise.all([
      // Total assets
      prisma.asset.count({
        where: { businessUnitId, isActive: true },
      }),
      
      // Active assets (not retired/disposed)
      prisma.asset.count({
        where: { 
          businessUnitId, 
          isActive: true,
          status: { notIn: [AssetStatus.RETIRED, AssetStatus.DISPOSED] }
        },
      }),
      
      // Deployed assets
      prisma.asset.count({
        where: { 
          businessUnitId, 
          isActive: true,
          status: AssetStatus.DEPLOYED 
        },
      }),
      
      // Available assets
      prisma.asset.count({
        where: { 
          businessUnitId, 
          isActive: true,
          status: AssetStatus.AVAILABLE 
        },
      }),
      
      // Maintenance assets
      prisma.asset.count({
        where: { 
          businessUnitId, 
          isActive: true,
          status: AssetStatus.IN_MAINTENANCE 
        },
      }),
      
      // Retired assets
      prisma.asset.count({
        where: { 
          businessUnitId, 
          isActive: true,
          status: AssetStatus.RETIRED 
        },
      }),
      
      // Total purchase value
      prisma.asset.aggregate({
        where: { businessUnitId, isActive: true },
        _sum: { purchasePrice: true },
      }).then(result => Number(result._sum.purchasePrice) || 0),
      
      // Current book value (depreciated)
      prisma.asset.aggregate({
        where: { businessUnitId, isActive: true },
        _sum: { currentBookValue: true },
      }).then(result => Number(result._sum.currentBookValue) || 0),
      
      // Pending deployments
      prisma.assetDeployment.count({
        where: {
          businessUnitId,
          status: DeploymentStatus.PENDING_ACCOUNTING_APPROVAL,
        },
      }),
      
      // Pending returns
      prisma.assetDeployment.count({
        where: {
          businessUnitId,
          status: DeploymentStatus.DEPLOYED,
          returnedDate: null,
        },
      }),
      
      // Categories count
      prisma.assetCategory.count({
        where: { businessUnitId, isActive: true },
      }),
      
      // Departments with assets count
      prisma.department.count({
        where: {
          businessUnitId,
          assets: { some: { isActive: true } },
        },
      }),
    ]);

    return {
      totalAssets,
      activeAssets,
      deployedAssets,
      availableAssets,
      maintenanceAssets,
      retiredAssets,
      totalValue,
      depreciatedValue,
      pendingDeployments,
      pendingReturns,
      categoriesCount,
      departmentsCount,
    };
  } catch (error) {
    console.error("Get asset dashboard stats error:", error);
    throw error;
  }
}

// Get asset status distribution
export async function getAssetStatusDistribution(businessUnitId: string): Promise<AssetStatusDistribution[]> {
  try {
    await checkAssetManagementAccess(businessUnitId);
    
    const statusCounts = await prisma.asset.groupBy({
      by: ['status'],
      where: { businessUnitId, isActive: true },
      _count: { status: true },
    });
    
    const totalAssets = statusCounts.reduce((sum, item) => sum + item._count.status, 0);
    
    return statusCounts.map(item => ({
      status: item.status,
      count: item._count.status,
      percentage: totalAssets > 0 ? (item._count.status / totalAssets) * 100 : 0,
    }));
  } catch (error) {
    console.error("Get asset status distribution error:", error);
    return [];
  }
}

// Get asset category statistics
export async function getAssetCategoryStats(businessUnitId: string): Promise<AssetCategoryStats[]> {
  try {
    await checkAssetManagementAccess(businessUnitId);
    
    const categories = await prisma.assetCategory.findMany({
      where: { businessUnitId, isActive: true },
      include: {
        assets: {
          where: { isActive: true },
          select: {
            purchasePrice: true,
          },
        },
        _count: {
          select: {
            assets: {
              where: { isActive: true },
            },
          },
        },
      },
    });
    
    return categories.map(category => {
      const totalValue = category.assets.reduce(
        (sum, asset) => sum + (Number(asset.purchasePrice) || 0), 
        0
      );
      const count = category._count.assets;
      
      return {
        id: category.id,
        name: category.name,
        code: category.code,
        count,
        totalValue,
        averageValue: count > 0 ? totalValue / count : 0,
      };
    });
  } catch (error) {
    console.error("Get asset category stats error:", error);
    return [];
  }
}

// Get recent asset activities
export async function getRecentAssetActivities(businessUnitId: string): Promise<RecentAssetActivity[]> {
  try {
    await checkAssetManagementAccess(businessUnitId);
    
    const activities = await prisma.assetHistory.findMany({
      where: { businessUnitId },
      include: {
        asset: {
          select: {
            itemCode: true,
            description: true,
          },
        },
      },
      orderBy: { performedAt: 'desc' },
      take: 10,
    });
    
    return activities.map(activity => ({
      id: activity.id,
      action: activity.action,
      assetCode: activity.asset.itemCode,
      assetDescription: activity.asset.description,
      performedBy: activity.performedById || 'System',
      performedAt: activity.performedAt,
      notes: activity.notes,
    }));
  } catch (error) {
    console.error("Get recent asset activities error:", error);
    return [];
  }
}

// Get depreciation summary
export async function getDepreciationSummary(businessUnitId: string): Promise<DepreciationSummary> {
  try {
    await checkAssetManagementAccess(businessUnitId);
    
    const [originalValue, currentValue, monthlyDep] = await Promise.all([
      prisma.asset.aggregate({
        where: { businessUnitId, isActive: true },
        _sum: { purchasePrice: true },
      }),
      prisma.asset.aggregate({
        where: { businessUnitId, isActive: true },
        _sum: { currentBookValue: true },
      }),
      prisma.asset.aggregate({
        where: { businessUnitId, isActive: true },
        _sum: { monthlyDepreciation: true },
      }),
    ]);
    
    const totalOriginalValue = Number(originalValue._sum.purchasePrice) || 0;
    const totalCurrentValue = Number(currentValue._sum.currentBookValue) || 0;
    const totalDepreciation = totalOriginalValue - totalCurrentValue;
    const depreciationRate = totalOriginalValue > 0 ? (totalDepreciation / totalOriginalValue) * 100 : 0;
    const monthlyDepreciation = Number(monthlyDep._sum.monthlyDepreciation) || 0;
    
    return {
      totalOriginalValue,
      totalCurrentValue,
      totalDepreciation,
      depreciationRate,
      monthlyDepreciation,
    };
  } catch (error) {
    console.error("Get depreciation summary error:", error);
    return {
      totalOriginalValue: 0,
      totalCurrentValue: 0,
      totalDepreciation: 0,
      depreciationRate: 0,
      monthlyDepreciation: 0,
    };
  }
}

// Get deployment statistics
export async function getDeploymentStats(businessUnitId: string): Promise<DeploymentStats> {
  try {
    await checkAssetManagementAccess(businessUnitId);
    
    const [
      totalDeployments,
      activeDeployments,
      pendingApproval,
      pendingReturn,
      departmentStats,
    ] = await Promise.all([
      prisma.assetDeployment.count({
        where: { businessUnitId },
      }),
      
      prisma.assetDeployment.count({
        where: { 
          businessUnitId,
          status: DeploymentStatus.DEPLOYED,
        },
      }),
      
      prisma.assetDeployment.count({
        where: { 
          businessUnitId,
          status: DeploymentStatus.PENDING_ACCOUNTING_APPROVAL,
        },
      }),
      
      prisma.assetDeployment.count({
        where: { 
          businessUnitId,
          status: DeploymentStatus.DEPLOYED,
          returnedDate: null,
        },
      }),
      
      prisma.assetDeployment.groupBy({
        by: ['businessUnitId'],
        where: { 
          businessUnitId,
          status: DeploymentStatus.DEPLOYED,
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);
    
    // Get top departments (simplified for now)
    const topDepartments = [
      { departmentName: 'IT Department', count: Math.floor(activeDeployments * 0.3) },
      { departmentName: 'Finance', count: Math.floor(activeDeployments * 0.25) },
      { departmentName: 'Operations', count: Math.floor(activeDeployments * 0.2) },
      { departmentName: 'HR', count: Math.floor(activeDeployments * 0.15) },
      { departmentName: 'Others', count: Math.floor(activeDeployments * 0.1) },
    ];
    
    return {
      totalDeployments,
      activeDeployments,
      pendingApproval,
      pendingReturn,
      topDepartments,
    };
  } catch (error) {
    console.error("Get deployment stats error:", error);
    return {
      totalDeployments: 0,
      activeDeployments: 0,
      pendingApproval: 0,
      pendingReturn: 0,
      topDepartments: [],
    };
  }
}

// Get asset trends (last 6 months)
export async function getAssetTrends(businessUnitId: string): Promise<AssetTrends[]> {
  try {
    await checkAssetManagementAccess(businessUnitId);
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // For now, return mock data - in production you'd calculate actual trends
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        newAssets: Math.floor(Math.random() * 20) + 5,
        deployments: Math.floor(Math.random() * 15) + 10,
        returns: Math.floor(Math.random() * 10) + 5,
        disposals: Math.floor(Math.random() * 5) + 1,
      });
    }
    
    return months;
  } catch (error) {
    console.error("Get asset trends error:", error);
    return [];
  }
}