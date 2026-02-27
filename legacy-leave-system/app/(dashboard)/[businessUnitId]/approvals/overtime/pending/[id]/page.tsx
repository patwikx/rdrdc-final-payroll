import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getOvertimeRequestForApproval } from "@/lib/actions/approval-actions";
import { OvertimeApprovalDetails } from "@/components/approvals/overtime-approval-details";

interface OvertimeApprovalPageProps {
  params: Promise<{
    businessUnitId: string;
    id: string;
  }>;
}

export default async function OvertimeApprovalPage({ params }: OvertimeApprovalPageProps) {
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
    const overtimeRequest = await getOvertimeRequestForApproval(id, businessUnitId);
    
    if (!overtimeRequest) {
      redirect(`/${businessUnitId}/approvals/overtime/pending`);
    }
    
    return (
      <div className="space-y-6">
        <OvertimeApprovalDetails 
          overtimeRequest={overtimeRequest}
          businessUnitId={businessUnitId}
          currentUser={session.user}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading overtime request:", error);
    redirect(`/${businessUnitId}/approvals/overtime/pending`);
  }
}