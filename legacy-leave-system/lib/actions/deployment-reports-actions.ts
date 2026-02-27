"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DeploymentStatus } from "@prisma/client";

export interface DeploymentReportData {
  id: string;
  transmittalNumber: string;
  deployedDate: Date | null;
  expectedReturnDate: Date | null;
  returnedDate: Date | null;
  status: DeploymentStatus;
  deploymentNotes: string | null;
  returnNotes: string | null;
  deploymentCondition: string | null;
  returnCondition: string | null;
  accountingApprovedAt: Date | null;
  createdAt: Date;
  asset: {
    id: string;
    itemCode: string;
    description: string;
    serialNumber: string | null;
    brand: string | null;
    modelNumber: string | null;
    purchasePrice: number | null;
    currentBookValue: number | null;
    category: {
      id: string;
      name: string;
      code: string;
    };
  };
  employee: {
    id: string;
    name: string;
    employeeId: string;
    position: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  };
  businessUnit: {
    id: string;
    name: string;
    code: string;
  };
  accountingApprover: {
    id: string;
    name: string;
    employeeId: string;
  } | null;
}

export interface DeploymentReportFilters {
  startDate?: Date;
  endDate?: Date;
  employeeId?: string;
  departmentId?: string;
  categoryId?: string;
  status?: DeploymentStatus | 'ALL';
  includeReturned?: boolean;
}

export interface DeploymentReportSummary {
  totalDeployments: number;
  activeDeployments: number;
  returnedDeployments: number;
  pendingApproval: number;
  totalAssetValue: number;
  averageDeploymentDuration: number; // in days
  departmentBreakdown: Array<{
    departmentName: string;
    count: number;
    totalValue: number;
  }>;
  categoryBreakdown: Array<{
    categoryName: string;
    count: number;
    totalValue: number;
  }>;
}

// Check if user has access to business unit
async function checkBusinessUnitAccess(businessUnitId: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  // Admins and HR can access any business unit
  if (session.user.role === "ADMIN" || session.user.role === "HR" || session.user.role === "ACCTG") {
    return session.user;
  }
  
  // Regular users and managers can only access their own business unit
  if (!session.user.businessUnit?.id) {
    throw new Error("User not assigned to any business unit");
  }
  
  if (session.user.businessUnit.id !== businessUnitId) {
    throw new Error(`Access denied: User business unit ${session.user.businessUnit.id} does not match requested ${businessUnitId}`);
  }
  
  return session.user;
}

// Get deployment report data
export async function getDeploymentReportData(
  businessUnitId: string,
  filters: DeploymentReportFilters = {}
): Promise<DeploymentReportData[]> {
  try {
    await checkBusinessUnitAccess(businessUnitId);

    const whereClause: any = {
      businessUnitId,
    };

    // Apply filters
    if (filters.startDate || filters.endDate) {
      whereClause.deployedDate = {};
      if (filters.startDate) {
        whereClause.deployedDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.deployedDate.lte = filters.endDate;
      }
    }

    if (filters.employeeId && filters.employeeId !== 'all') {
      whereClause.employeeId = filters.employeeId;
    }

    if (filters.departmentId && filters.departmentId !== 'all') {
      whereClause.employee = {
        department: {
          id: filters.departmentId,
        },
      };
    }

    if (filters.categoryId && filters.categoryId !== 'all') {
      whereClause.asset = {
        categoryId: filters.categoryId,
      };
    }

    if (filters.status && filters.status !== 'ALL') {
      whereClause.status = filters.status as DeploymentStatus;
    }

    // If includeReturned is false, exclude returned deployments
    if (filters.includeReturned === false) {
      whereClause.returnedDate = null;
    }

    const deployments = await prisma.assetDeployment.findMany({
      where: whereClause,
      include: {
        asset: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        employee: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        accountingApprover: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
      },
      orderBy: [
        { employee: { department: { name: 'asc' } } },
        { employee: { name: 'asc' } },
        { deployedDate: 'desc' },
      ],
    });

    return deployments.map(deployment => ({
      id: deployment.id,
      transmittalNumber: deployment.transmittalNumber,
      deployedDate: deployment.deployedDate,
      expectedReturnDate: deployment.expectedReturnDate,
      returnedDate: deployment.returnedDate,
      status: deployment.status,
      deploymentNotes: deployment.deploymentNotes,
      returnNotes: deployment.returnNotes,
      deploymentCondition: deployment.deploymentCondition,
      returnCondition: deployment.returnCondition,
      accountingApprovedAt: deployment.accountingApprovedAt,
      createdAt: deployment.createdAt,
      asset: {
        id: deployment.asset.id,
        itemCode: deployment.asset.itemCode,
        description: deployment.asset.description,
        serialNumber: deployment.asset.serialNumber,
        brand: deployment.asset.brand,
        modelNumber: deployment.asset.modelNumber,
        purchasePrice: deployment.asset.purchasePrice ? Number(deployment.asset.purchasePrice) : null,
        currentBookValue: deployment.asset.currentBookValue ? Number(deployment.asset.currentBookValue) : null,
        category: deployment.asset.category,
      },
      employee: {
        id: deployment.employee.id,
        name: deployment.employee.name,
        employeeId: deployment.employee.employeeId,
        position: deployment.employee.position,
        department: deployment.employee.department,
      },
      businessUnit: deployment.businessUnit,
      accountingApprover: deployment.accountingApprover,
    }));
  } catch (error) {
    console.error("Get deployment report data error:", error);
    throw error;
  }
}

// Get deployment report summary
export async function getDeploymentReportSummary(
  businessUnitId: string,
  filters: DeploymentReportFilters = {}
): Promise<DeploymentReportSummary> {
  try {
    await checkBusinessUnitAccess(businessUnitId);

    const deployments = await getDeploymentReportData(businessUnitId, filters);

    const totalDeployments = deployments.length;
    const activeDeployments = deployments.filter(d => d.status === DeploymentStatus.DEPLOYED && !d.returnedDate).length;
    const returnedDeployments = deployments.filter(d => d.returnedDate !== null).length;
    const pendingApproval = deployments.filter(d => d.status === DeploymentStatus.PENDING_ACCOUNTING_APPROVAL).length;

    const totalAssetValue = deployments.reduce((sum, d) => {
      return sum + (d.asset.currentBookValue || d.asset.purchasePrice || 0);
    }, 0);

    // Calculate average deployment duration for returned assets
    const returnedWithDuration = deployments.filter(d => d.deployedDate && d.returnedDate);
    const averageDeploymentDuration = returnedWithDuration.length > 0
      ? returnedWithDuration.reduce((sum, d) => {
          const duration = Math.ceil((new Date(d.returnedDate!).getTime() - new Date(d.deployedDate!).getTime()) / (1000 * 60 * 60 * 24));
          return sum + duration;
        }, 0) / returnedWithDuration.length
      : 0;

    // Department breakdown
    const departmentMap = new Map<string, { count: number; totalValue: number }>();
    deployments.forEach(d => {
      const deptName = d.employee.department?.name || 'No Department';
      const value = d.asset.currentBookValue || d.asset.purchasePrice || 0;
      
      if (!departmentMap.has(deptName)) {
        departmentMap.set(deptName, { count: 0, totalValue: 0 });
      }
      
      const dept = departmentMap.get(deptName)!;
      dept.count += 1;
      dept.totalValue += value;
    });

    const departmentBreakdown = Array.from(departmentMap.entries()).map(([name, data]) => ({
      departmentName: name,
      count: data.count,
      totalValue: data.totalValue,
    })).sort((a, b) => b.count - a.count);

    // Category breakdown
    const categoryMap = new Map<string, { count: number; totalValue: number }>();
    deployments.forEach(d => {
      const categoryName = d.asset.category.name;
      const value = d.asset.currentBookValue || d.asset.purchasePrice || 0;
      
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { count: 0, totalValue: 0 });
      }
      
      const category = categoryMap.get(categoryName)!;
      category.count += 1;
      category.totalValue += value;
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([name, data]) => ({
      categoryName: name,
      count: data.count,
      totalValue: data.totalValue,
    })).sort((a, b) => b.count - a.count);

    return {
      totalDeployments,
      activeDeployments,
      returnedDeployments,
      pendingApproval,
      totalAssetValue,
      averageDeploymentDuration,
      departmentBreakdown,
      categoryBreakdown,
    };
  } catch (error) {
    console.error("Get deployment report summary error:", error);
    return {
      totalDeployments: 0,
      activeDeployments: 0,
      returnedDeployments: 0,
      pendingApproval: 0,
      totalAssetValue: 0,
      averageDeploymentDuration: 0,
      departmentBreakdown: [],
      categoryBreakdown: [],
    };
  }
}

// Get filter options for the report
export async function getDeploymentReportFilterOptions(businessUnitId: string) {
  try {
    await checkBusinessUnitAccess(businessUnitId);

    const [employees, departments, categories] = await Promise.all([
      // Get employees who have deployments
      prisma.user.findMany({
        where: {
          businessUnitId,
          deployments: {
            some: {},
          },
        },
        select: {
          id: true,
          name: true,
          employeeId: true,
        },
        orderBy: { name: 'asc' },
      }),

      // Get departments that have employees with deployments
      prisma.department.findMany({
        where: {
          businessUnitId,
          members: {
            some: {
              deployments: {
                some: {},
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      }),

      // Get asset categories that have deployed assets
      prisma.assetCategory.findMany({
        where: {
          businessUnitId,
          assets: {
            some: {
              deployments: {
                some: {},
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      employees,
      departments,
      categories,
    };
  } catch (error) {
    console.error("Get deployment report filter options error:", error);
    return {
      employees: [],
      departments: [],
      categories: [],
    };
  }
}