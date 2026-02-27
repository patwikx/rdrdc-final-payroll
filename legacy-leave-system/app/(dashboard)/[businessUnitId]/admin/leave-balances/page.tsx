import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAdminLeaveBalances } from "@/lib/actions/admin-leave-balance-actions";
import { LeaveBalancesManagementView } from "@/components/admin/leave-balances-management-view";

interface AdminLeaveBalancesPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    year?: string;
    leaveTypeId?: string;
    userId?: string;
    page?: string;
  }>;
}

export default async function AdminLeaveBalancesPage({ params, searchParams }: AdminLeaveBalancesPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  const { businessUnitId } = await params
  
  // Check if user has admin permissions
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    redirect(`/${businessUnitId}/unauthorized`);
  }

  const { year, leaveTypeId, userId, page = "1" } = await searchParams;
  
  try {
    const balancesData = await getAdminLeaveBalances({
      businessUnitId,
      year: year ? parseInt(year) : undefined,
      leaveTypeId,
      userId,
      page: parseInt(page),
      limit: 20
    });
    
    return (
      <div className="space-y-6">
        <LeaveBalancesManagementView 
          balancesData={balancesData}
          businessUnitId={businessUnitId}
          currentFilters={{
            year: year ? parseInt(year) : undefined,
            leaveTypeId,
            userId,
            page: parseInt(page)
          }}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading admin leave balances:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Leave Balances Management</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load leave balances. Please try again later.</p>
        </div>
      </div>
    );
  }
}