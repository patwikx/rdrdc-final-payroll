import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LeaveRequestsView } from "@/components/leave-requests/leave-requests-view";
import { getLeaveRequests } from "@/lib/actions/leave-request-actions";

interface LeaveRequestsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    status?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function LeaveRequestsPage({ params, searchParams }: LeaveRequestsPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const { businessUnitId } = await params;
  const { status, type, page = "1" } = await searchParams;
  
  try {
    const leaveRequestsData = await getLeaveRequests({
      userId: session.user.id,
      businessUnitId,
      status,
      leaveTypeId: type,
      page: parseInt(page),
      limit: 10
    });
    
    return (
      <div className="space-y-6">
        <LeaveRequestsView 
          leaveRequestsData={leaveRequestsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            status,
            type,
            page: parseInt(page)
          }}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading leave requests:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mt-2">My Leave Requests</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load leave requests. Please try again later.</p>
        </div>
      </div>
    );
  }
}