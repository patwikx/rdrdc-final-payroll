import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLeaveRequestById } from "@/lib/actions/leave-request-actions";
import { getLeaveTypes } from "@/lib/actions/request-actions";
import { LeaveRequestDetailsPage } from "@/components/leave-requests/leave-request-details-page";

interface LeaveRequestPageProps {
  params: Promise<{
    businessUnitId: string;
    id: string;
  }>;
}

export default async function LeaveRequestPage({ params }: LeaveRequestPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const { businessUnitId, id } = await params;
  
  try {
    const [request, leaveTypes] = await Promise.all([
      getLeaveRequestById(id, session.user.id),
      getLeaveTypes()
    ]);
    
    if (!request) {
      redirect(`/${businessUnitId}/leave-requests`);
    }
    
    return (
      <div className="space-y-6">
        <LeaveRequestDetailsPage 
          request={request}
          leaveTypes={leaveTypes}
          businessUnitId={businessUnitId}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading leave request:", error);
    redirect(`/${businessUnitId}/leave-requests`);
  }
}