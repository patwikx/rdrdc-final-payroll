import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRDHApprovedRequests } from "@/lib/actions/mrs-actions/material-request-actions";
import { RDHApprovedRequestsView } from "@/components/material-requests/rdh-approved-requests-view";

interface ApprovedRequestsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function ApprovedRequestsPage({ 
  params 
}: ApprovedRequestsPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  const { businessUnitId } = await params;
  
  // Only users with isRDHMRS = true OR MANAGER role OR isAcctg = true can access this page
  if (!session.user.isRDHMRS && session.user.role !== 'MANAGER' && !session.user.isAcctg) {
    redirect(`/${businessUnitId}/unauthorized`);
  }
  
  try {
    const requests = await getRDHApprovedRequests(businessUnitId);
    
    return (
      <div className="space-y-6">
        <RDHApprovedRequestsView 
          requests={requests}
          businessUnitId={businessUnitId}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading approved requests:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Approved Material Requests</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load approved requests. Please try again later.</p>
        </div>
      </div>
    );
  }
}
