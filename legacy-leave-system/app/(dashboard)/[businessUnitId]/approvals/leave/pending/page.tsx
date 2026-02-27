import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPendingLeaveRequests } from "@/lib/actions/approval-actions";
import { PendingLeaveApprovalsView } from "@/components/approvals/pending-leave-approvals-view";

interface PendingLeavePageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    status?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function PendingLeavePage({ params, searchParams }: PendingLeavePageProps) {
  const session = await auth();
  
  const { businessUnitId } = await params;

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  // Check if user has approval permissions
  if (session.user.role !== "ADMIN" && session.user.role !== "HR" && session.user.role !== "MANAGER" && session.user.role !== "ACCTG_MANAGER" && session.user.role !== "PURCHASING_MANAGER") {
    redirect(`/${businessUnitId}/unauthorized`);
  }


  const { status, type, page = "1" } = await searchParams;
  
  try {
    const pendingApprovalsData = await getPendingLeaveRequests({
      businessUnitId,
      status,
      leaveTypeId: type,
      page: parseInt(page),
      limit: 10
    });
    
    return (
      <div className="space-y-6">
        <PendingLeaveApprovalsView 
          approvalsData={pendingApprovalsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            status,
            type,
            page: parseInt(page)
          }}
          currentUserRole={session.user.role}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading pending leave requests:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pending Leave Approvals</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load pending requests. Please try again later.</p>
        </div>
      </div>
    );
  }
}