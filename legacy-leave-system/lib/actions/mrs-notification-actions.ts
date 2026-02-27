"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export interface MRSNeedingPurchasing {
  id: string;
  docNo: string;
  series: string;
  purpose: string | null;
  dateRequired: Date;
  dateApproved: Date | null;
  status: string;
  totalAmount: number;
  department: {
    name: string;
  } | null;
  requestedBy: {
    name: string;
  } | null;
  itemsCount: number;
}

export async function getMRSNotificationCount(businessUnitId: string): Promise<number> {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  // Check user access to business unit
  if (session.user.role !== "ADMIN" && session.user.role !== "ACCTG") {
    if (!session.user.businessUnit?.id) {
      throw new Error("User not assigned to any business unit");
    }
    
    // Special handling for the "unauthorized" case
    if (businessUnitId === "unauthorized") {
      console.error("MRS Navigation error detected: businessUnitId is 'unauthorized'", {
        userBusinessUnitId: session.user.businessUnit.id,
        userRole: session.user.role,
        userName: session.user.name
      });
      throw new Error(`Navigation error: Invalid business unit ID 'unauthorized'. User should be accessing /${session.user.businessUnit.id} instead.`);
    }
    
    // Purchasers can access any business unit
    if (!session.user.isPurchaser && session.user.businessUnit.id !== businessUnitId) {
      throw new Error("Access denied to this business unit");
    }
  }

  // Only show to users with purchasing access
  if (!session.user.isPurchaser) {
    return 0;
  }

  try {
    const count = await prisma.materialRequest.count({
      where: {
        businessUnitId: businessUnitId,
        status: "FOR_SERVING"
      }
    });

    return count;
  } catch (error) {
    console.error("Error getting MRS notification count:", error);
    return 0;
  }
}

export async function getMRSNeedingPurchasing(businessUnitId: string): Promise<MRSNeedingPurchasing[]> {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  // Check user access to business unit
  // Admins, Accounting, and Purchasing users can access any business unit
  if (session.user.role !== "ADMIN" && !session.user.isAcctg && !session.user.isPurchaser) {
    if (!session.user.businessUnit?.id || session.user.businessUnit.id !== businessUnitId) {
      throw new Error("Access denied to this business unit");
    }
  }

  // Only show to users with purchasing access
  if (!session.user.isPurchaser) {
    return [];
  }

  try {
    const materialRequests = await prisma.materialRequest.findMany({
      where: {
        businessUnitId: businessUnitId,
        status: "FOR_SERVING"
      },
      include: {
        department: {
          select: {
            name: true
          }
        },
        requestedBy: {
          select: {
            name: true
          }
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true
          }
        }
      },
      orderBy: [
        {
          dateApproved: 'asc'
        },
        {
          dateRequired: 'asc'
        }
      ]
    });

    return materialRequests.map(mrs => ({
      id: mrs.id,
      docNo: mrs.docNo,
      series: mrs.series,
      purpose: mrs.purpose,
      dateRequired: mrs.dateRequired,
      dateApproved: mrs.dateApproved,
      status: mrs.status,
      totalAmount: mrs.items.reduce((sum: number, item: any) => sum + (item.quantity * (item.unitPrice || 0)), 0),
      department: mrs.department,
      requestedBy: mrs.requestedBy,
      itemsCount: mrs.items.length
    }));
  } catch (error) {
    console.error("Error getting MRS needing purchasing:", error);
    return [];
  }
}