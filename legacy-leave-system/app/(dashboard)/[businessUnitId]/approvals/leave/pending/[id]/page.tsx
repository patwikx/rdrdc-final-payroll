import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLeaveRequestForApproval } from "@/lib/actions/approval-actions";
import { LeaveApprovalDetails } from "@/components/approvals/leave-approval-details";

interface LeaveApprovalPageProps {
  params: Promise<{
    businessUnitId: string;
    id: string;
  }>;
}

export default async function LeaveApprovalPage({ params }: LeaveApprovalPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  // Check if user has approval permissions
  if (session.user.role !== "ADMIN" && session.user.role !== "HR" && session.user.role !== "MANAGER") {
    redirect("/unauthorized");
  }

  const { businessUnitId, id } = await params;
  
  try {
    const leaveRequest = await getLeaveRequestForApproval(id, businessUnitId);
    
    if (!leaveRequest) {
      redirect(`/${businessUnitId}/approvals/leave/pending`);
    }
    
    return (
      <div className="space-y-6">
        <LeaveApprovalDetails 
          leaveRequest={leaveRequest}
          businessUnitId={businessUnitId}
          currentUser={session.user}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading leave request:", error);
    redirect(`/${businessUnitId}/approvals/leave/pending`);
  }
}