import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getApprovalHistory } from "@/lib/actions/approval-actions";
import { ApprovalHistoryView } from "@/components/approvals/approval-history-view";

interface ApprovalHistoryPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    type?: string;
    status?: string;
    leaveTypeId?: string;
    page?: string;
  }>;
}

export default async function ApprovalHistoryPage({ params, searchParams }: ApprovalHistoryPageProps) {
  const session = await auth();
  
  const { businessUnitId } = await params;

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  // Check if user has approval permissions
  if (session.user.role !== "ADMIN" && session.user.role !== "HR" && session.user.role !== "MANAGER") {
    redirect(`/${businessUnitId}/unauthorized`);
  }


  const { type, status, leaveTypeId, page = "1" } = await searchParams;
  
  // Sanitize filter values - convert any 'all-*' values to undefined
  const sanitizedType = type && !type.startsWith('all') ? type as 'leave' | 'overtime' : undefined;
  const sanitizedStatus = status && !status.startsWith('all') ? status as 'APPROVED' | 'REJECTED' : undefined;
  const sanitizedLeaveTypeId = leaveTypeId && !leaveTypeId.startsWith('all') ? leaveTypeId : undefined;
  
  try {
    const historyData = await getApprovalHistory({
      businessUnitId,
      type: sanitizedType,
      status: sanitizedStatus,
      leaveTypeId: sanitizedLeaveTypeId,
      page: parseInt(page),
      limit: 10
    });
    
    return (
      <div className="space-y-6">
        <ApprovalHistoryView 
          historyData={historyData}
          businessUnitId={businessUnitId}
          currentFilters={{
            type,
            status,
            leaveTypeId,
            page: parseInt(page)
          }}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading approval history:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Approval History</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load approval history. Please try again later.</p>
        </div>
      </div>
    );
  }
}