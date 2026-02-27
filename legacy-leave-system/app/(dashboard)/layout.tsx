import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import type { BusinessUnitItem } from '@/types/business-unit-types';
import { prisma } from '@/lib/prisma';
import "../globals.css";
import { Toaster } from 'sonner';
import { BusinessUnitProvider } from '@/context/business-unit-context';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarWrapper } from '@/components/sidebar/sidebar-wrapper';
import type { Session } from 'next-auth';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { DynamicBreadcrumbs } from '@/components/dynamic-breadcurmbs';
import { SecurityMonitor } from '@/components/auth/security-monitor';
import { SessionMonitor } from '@/components/auth/session-monitor';
import { SessionProvider } from 'next-auth/react';

export const metadata = {
  title: "Dashboard | Leave Management System",
  description: "Leave Management System for RD Realty Group",
};

// Type guard to ensure we have a complete user session
function isValidUserSession(session: Session | null): session is Session & {
  user: NonNullable<Session['user']> & {
    businessUnit: NonNullable<Session['user']['businessUnit']>;
    role: NonNullable<Session['user']['role']>;
  }
} {
  return !!(
    session?.user?.id &&
    session.user.businessUnit?.id &&
    session.user.role
  );
}

// Helper function to check if user is admin based on role
function isUserAdmin(role: string): boolean {
  const adminRoles = ['ADMIN', 'HR'] as const;
  return adminRoles.includes(role as typeof adminRoles[number]);
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers();
  const businessUnitId = headersList.get("x-business-unit-id");
  const session = await auth();

  // Redirect to sign-in if there's no session or user
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  // Note: User active status check removed as it's not in the current schema
  // If you need this functionality, add an 'isActive' field to your User model

  // Ensure we have a complete user session
  if (!isValidUserSession(session)) {
    redirect("/auth/sign-in?error=IncompleteProfile");
  }

  // Force logout if no business unit in URL - this indicates a malformed URL or tampering
  if (!businessUnitId) {
    redirect("/auth/sign-in?error=InvalidAccess&logout=true");
  }

  // Validate that the business unit ID is a valid format (basic validation)
  if (businessUnitId.length < 10 || !businessUnitId.startsWith('cm')) {
    redirect("/auth/sign-in?error=InvalidBusinessUnit&logout=true");
  }

  // Check if user is admin based on their role
  const isAdmin = isUserAdmin(session.user.role);
  
  // Check if user has purchaser access
  const isPurchaser = session.user.isPurchaser || false;

  // Check if user is authorized for the requested business unit
  // Admins and purchaser users can access any unit, regular users can only access their assigned unit
  const isAuthorizedForUnit = isAdmin || isPurchaser || session.user.businessUnit.id === businessUnitId;

  // Force logout if user is not authorized for the requested unit
  if (!isAuthorizedForUnit) {
    redirect("/auth/sign-in?error=UnauthorizedAccess&logout=true");
  }

  let businessUnits: BusinessUnitItem[] = [];

  // If the user is an admin or has purchaser access, fetch all business units from the database
  if (isAdmin || isPurchaser) {
    try {
      businessUnits = await prisma.businessUnit.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          image: true,
        },
      });
    } catch (error) {
      console.error("Failed to fetch business units:", error);
      // Fallback to user's own business unit
      businessUnits = [{
        id: session.user.businessUnit.id,
        code: session.user.businessUnit.code,
        name: session.user.businessUnit.name,
        image: null,
      }];
    }
  } else {
    // Regular users only see their assigned business unit, but they should still see the logo
    try {
      const userBusinessUnit = await prisma.businessUnit.findUnique({
        where: { id: session.user.businessUnit.id },
        select: {
          id: true,
          code: true,
          name: true,
          image: true,
        },
      });

      businessUnits = [{
        id: userBusinessUnit?.id || session.user.businessUnit.id,
        code: userBusinessUnit?.code || session.user.businessUnit.code,
        name: userBusinessUnit?.name || session.user.businessUnit.name,
        image: userBusinessUnit?.image || null,
      }];
    } catch (error) {
      console.error("Failed to fetch user's business unit:", error);
      // Fallback without image
      businessUnits = [{
        id: session.user.businessUnit.id,
        code: session.user.businessUnit.code,
        name: session.user.businessUnit.name,
        image: null,
      }];
    }
  }

  // Fetch complete user data including profile picture
  let completeUserData = null;
  try {
    completeUserData = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        classification: true,
        profilePicture: true,
        businessUnit: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch complete user data:", error);
  }

  // Create enhanced session with profile picture
  const enhancedSession = {
    ...session,
    user: {
      ...session.user,
      profilePicture: completeUserData?.profilePicture || null,
    },
  };

  // Fetch pending counts for approvers
  let pendingCounts = undefined;
  const isApprover = ['ADMIN', 'MANAGER', 'HR'].includes(session.user.role) || session.user.isAcctg || isPurchaser;
  
  if (isApprover) {
    try {
      const userId = session.user.id;
      const userRole = session.user.role;

      // Build where clauses based on role
      let leaveWhereClause: any = {};
      let overtimeWhereClause: any = {};
      let materialRequestWhereClause: any = {};

      if (userRole === "ADMIN") {
        leaveWhereClause = {
          user: { 
            businessUnitId,
            employeeId: { notIn: ["T-123", "admin"] }
          },
          status: { in: ["PENDING_MANAGER", "PENDING_HR"] },
        };
        overtimeWhereClause = {
          user: { 
            businessUnitId,
            employeeId: { notIn: ["T-123", "admin"] }
          },
          status: { in: ["PENDING_MANAGER", "PENDING_HR"] },
        };
      } else if (userRole === "HR") {
        leaveWhereClause = {
          user: { employeeId: { notIn: ["T-123", "admin"] } },
          status: "PENDING_HR",
          managerActionBy: { not: null },
        };
        overtimeWhereClause = {
          user: { employeeId: { notIn: ["T-123", "admin"] } },
          status: "PENDING_HR",
          managerActionBy: { not: null },
        };
      } else if (userRole === "MANAGER") {
        leaveWhereClause = {
          user: { 
            approverId: userId,
            employeeId: { notIn: ["T-123", "admin"] }
          },
          status: "PENDING_MANAGER",
        };
        overtimeWhereClause = {
          user: { 
            approverId: userId,
            employeeId: { notIn: ["T-123", "admin"] }
          },
          status: "PENDING_MANAGER",
        };
      }

      // Material request where clause
      materialRequestWhereClause = {
        businessUnitId,
        OR: [
          {
            AND: [
              { recApproverId: userId },
              { status: "FOR_REC_APPROVAL" },
              {
                OR: [
                  { recApprovalStatus: null },
                  { recApprovalStatus: "PENDING" }
                ]
              }
            ]
          },
          {
            AND: [
              { finalApproverId: userId },
              { status: "FOR_FINAL_APPROVAL" },
              { recApprovalStatus: "APPROVED" },
              {
                OR: [
                  { finalApprovalStatus: null },
                  { finalApprovalStatus: "PENDING" }
                ]
              }
            ]
          }
        ]
      };

      // MRS Coordinator counts (for users with purchaser access)
      let mrsForServingWhereClause: Record<string, unknown> = {};
      let mrsForPostingWhereClause: Record<string, unknown> = {};
      let mrsDoneUnacknowledgedWhereClause: Record<string, unknown> = {};
      
      if (isPurchaser || userRole === "ADMIN") {
        mrsForServingWhereClause = {
          businessUnitId,
          status: "FOR_SERVING"
        };
        
        mrsForPostingWhereClause = {
          businessUnitId,
          status: "FOR_POSTING"
        };
        
        // Count done requests (POSTED status) that haven't been acknowledged yet
        mrsDoneUnacknowledgedWhereClause = {
          businessUnitId,
          status: "POSTED",
          acknowledgedAt: null
        };
      }

      // Asset depreciation count (for ADMIN and users with accounting access)
      // Count assets that need depreciation run (same logic as depreciation notification)
      const hasAssetAccess = isAdmin || session.user.isAcctg;
      let assetsNeedingDepreciationCount = 0;
      
      if (hasAssetAccess) {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          assetsNeedingDepreciationCount = await prisma.asset.count({
            where: {
              businessUnitId,
              isActive: true,
              status: {
                not: "DISPOSED"
              },
              isFullyDepreciated: false,
              nextDepreciationDate: {
                lte: today
              },
              depreciationMethod: {
                not: null
              },
              monthlyDepreciation: {
                gt: 0
              }
            }
          });
        } catch (error) {
          console.error("Failed to fetch asset depreciation count:", error);
        }
      }

      const [leaveCount, overtimeCount, materialRequestCount, mrsForServingCount, mrsForPostingCount, mrsDoneUnacknowledgedCount, budgetApprovalCount] = await Promise.all([
        prisma.leaveRequest.count({ where: leaveWhereClause }),
        prisma.overtimeRequest.count({ where: overtimeWhereClause }),
        prisma.materialRequest.count({ where: materialRequestWhereClause }),
        (isPurchaser || userRole === "ADMIN") ? prisma.materialRequest.count({ where: mrsForServingWhereClause }) : Promise.resolve(0),
        (isPurchaser || userRole === "ADMIN") ? prisma.materialRequest.count({ where: mrsForPostingWhereClause }) : Promise.resolve(0),
        (isPurchaser || userRole === "ADMIN") ? prisma.materialRequest.count({ where: mrsDoneUnacknowledgedWhereClause }) : Promise.resolve(0),
        session.user.isAcctg ? prisma.materialRequest.count({ 
          where: { 
            businessUnitId,
            status: "PENDING_BUDGET_APPROVAL" 
          } 
        }) : Promise.resolve(0),
      ]);

      pendingCounts = {
        leave: leaveCount,
        overtime: overtimeCount,
        materialRequests: materialRequestCount,
        mrsForServing: mrsForServingCount,
        mrsForPosting: mrsForPostingCount,
        mrsDoneUnacknowledged: mrsDoneUnacknowledgedCount,
        assetsNeedingDepreciation: assetsNeedingDepreciationCount,
        budgetApprovals: budgetApprovalCount,
      };
    } catch (error) {
      console.error("Failed to fetch pending counts:", error);
    }
  }

  return (
<SessionProvider>

    <SidebarWrapper>
      {/* Security Monitor - Client-side security checks */}
      <SecurityMonitor 
        userBusinessUnitId={session.user.businessUnit.id}
        userRole={session.user.role}
        isAcctg={session.user.isAcctg ?? false}
        isPurchaser={session.user.isPurchaser ?? false}
      />
      
      {/* Session Monitor - Hybrid JWT + Database session validation */}
      <SessionMonitor checkInterval={30000} />
      
      <div className="min-h-screen flex w-full">
        {/* App Sidebar */}
        <AppSidebar 
          session={enhancedSession}
          businessUnits={businessUnits}
          currentBusinessUnitId={businessUnitId}
          pendingCounts={pendingCounts}
        />
        
        {/* Main Content Area */}
        <SidebarInset className="flex-1">
       {/* Header with breadcrumb */}
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <DynamicBreadcrumbs businessUnitId={businessUnitId} />
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4">
            <BusinessUnitProvider businessUnitId={businessUnitId}>
              {children}
            </BusinessUnitProvider>
          </main>
        </SidebarInset>

        {/* Toast Notifications */}
        <Toaster />
      </div>
    </SidebarWrapper>
    </SessionProvider>
  )
}