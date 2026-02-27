"use server";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { AssetStatus, AssetDisposalReason, AssetHistoryAction } from "@prisma/client";

export interface DamagedLossReportData {
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
  status: string;
  location: string | null;
  assignedEmployee: {
    id: string;
    name: string;
    employeeId: string;
  } | null;
  disposal: {
    id: string;
    disposalDate: Date;
    reason: string;
    disposalMethod: string | null;
    disposalValue: number | null;
    bookValueAtDisposal: number;
    gainLoss: number | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    recipientName: string | null;
  } | null;
  lastHistoryEntry: {
    action: string;
    actionDate: Date;
    notes: string | null;
    performedBy: {
      name: string;
      employeeId: string;
    } | null;
  } | null;
}

export interface DamagedLossFilters {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  departmentId?: string;
  status?: AssetStatus;
  disposalReason?: AssetDisposalReason;
  includeDisposed?: boolean;
}

export async function getDamagedLossReportData(
  businessUnitId: string,
  filters: DamagedLossFilters = {}
): Promise<DamagedLossReportData[]> {
  // Build where clause for damaged/lost assets
  const whereClause = {
    businessUnitId,
    // Allow both active and inactive assets for disposed items
    ...(filters.includeDisposed ? {} : { isActive: true }),
    OR: [
      { status: AssetStatus.LOST },
      { status: AssetStatus.DAMAGED },
      ...(filters.includeDisposed ? [{ status: AssetStatus.DISPOSED }] : []),
    ],
    ...(filters.categoryId && filters.categoryId !== 'all' && { categoryId: filters.categoryId }),
    ...(filters.departmentId && filters.departmentId !== 'all' && { departmentId: filters.departmentId }),
    // Remove the status filter conflict - it was overriding the OR clause
    // ...(filters.status && { status: filters.status }),
    ...(filters.startDate && { purchaseDate: { gte: filters.startDate } }),
    ...(filters.endDate && { purchaseDate: { lte: filters.endDate } }),
  };

  // Debug logging
  console.log('Damaged Loss Query:', {
    whereClause,
    includeDisposed: filters.includeDisposed,
    businessUnitId
  });

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
      disposal: true,
      assetHistories: {
        where: {
          OR: [
            { action: AssetHistoryAction.LOST },
            { action: AssetHistoryAction.DAMAGED },
            { action: AssetHistoryAction.DISPOSED },
            { action: AssetHistoryAction.STATUS_CHANGED },
          ],
        },
        include: {
          employee: {
            select: {
              name: true,
              employeeId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
    orderBy: [
      { category: { name: 'asc' } },
      { status: 'asc' },
      { updatedAt: 'desc' },
    ],
  });

  return assets.map(asset => {
    const currentDeployment = asset.deployments[0];
    const lastHistory = asset.assetHistories[0];

    return {
      id: asset.id,
      itemCode: asset.itemCode,
      description: asset.description,
      serialNumber: asset.serialNumber,
      category: asset.category,
      department: asset.department,
      purchaseDate: asset.purchaseDate,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      currentBookValue: asset.currentBookValue ? Number(asset.currentBookValue) : null,
      accumulatedDepreciation: Number(asset.accumulatedDepreciation),
      status: asset.status,
      location: asset.location,
      assignedEmployee: currentDeployment?.employee || null,
      disposal: asset.disposal ? {
        id: asset.disposal.id,
        disposalDate: asset.disposal.disposalDate,
        reason: asset.disposal.reason,
        disposalMethod: asset.disposal.disposalMethod,
        disposalValue: asset.disposal.disposalValue ? Number(asset.disposal.disposalValue) : null,
        bookValueAtDisposal: Number(asset.disposal.bookValueAtDisposal),
        gainLoss: asset.disposal.gainLoss ? Number(asset.disposal.gainLoss) : null,
        approvedBy: asset.disposal.approvedBy,
        approvedAt: asset.disposal.approvedAt,
        recipientName: asset.disposal.recipientName,
      } : null,
      lastHistoryEntry: lastHistory ? {
        action: lastHistory.action,
        actionDate: lastHistory.createdAt,
        notes: lastHistory.notes,
        performedBy: lastHistory.employee,
      } : null,
    };
  });
}

export async function getDamagedLossFilterOptions(businessUnitId: string) {
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

  const assetStatuses = [
    { value: 'LOST', label: 'Lost' },
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'DISPOSED', label: 'Disposed' },
  ];

  const disposalReasons = [
    { value: 'LOST', label: 'Lost' },
    { value: 'STOLEN', label: 'Stolen' },
    { value: 'DAMAGED_BEYOND_REPAIR', label: 'Damaged Beyond Repair' },
    { value: 'SCRAPPED', label: 'Scrapped' },
    { value: 'END_OF_LIFE', label: 'End of Life' },
    { value: 'OBSOLETE', label: 'Obsolete' },
  ];

  return {
    categories,
    departments,
    assetStatuses,
    disposalReasons,
  };
}