import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPendingOvertimeRequests } from "@/lib/actions/approval-actions";
import { PendingOvertimeApprovalsView } from "@/components/approvals/pending-overtime-approvals-view";

interface PendingOvertimePageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function PendingOvertimePage({ params, searchParams }: PendingOvertimePageProps) {
  const session = await auth();
    const { businessUnitId } = await params;
    
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  // Check if user has approval permissions
if (session.user.role !== "ADMIN" && session.user.role !== "HR" && session.user.role !== "MANAGER" && session.user.role !== "ACCTG_MANAGER" && session.user.role !== "PURCHASING_MANAGER") {
    redirect(`/${businessUnitId}/unauthorized`);
  }


  const { status, page = "1" } = await searchParams;
  
  try {
    const pendingApprovalsData = await getPendingOvertimeRequests({
      businessUnitId,
      status,
      page: parseInt(page),
      limit: 10
    });
    
    return (
      <div className="space-y-6">
        <PendingOvertimeApprovalsView 
          approvalsData={pendingApprovalsData}
          businessUnitId={businessUnitId}
          currentUserRole={session.user.role}
          currentFilters={{
            status,
            page: parseInt(page)
          }}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading pending overtime requests:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pending Overtime Approvals</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load pending requests. Please try again later.</p>
        </div>
      </div>
    );
  }
}