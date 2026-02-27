import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPendingMaterialRequests } from "@/lib/actions/mrs-actions/material-request-approval-actions";
import { PendingMaterialRequestsView } from "@/components/approvals/pending-material-requests-view";

interface PendingMaterialRequestsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    status?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function PendingMaterialRequestsPage({ 
  params, 
  searchParams 
}: PendingMaterialRequestsPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  const { businessUnitId } = await params;
  
  // Check if user has approval permissions
if (session.user.role !== "ADMIN" && session.user.role !== "HR" && session.user.role !== "MANAGER" && session.user.role !== "ACCTG_MANAGER" && session.user.role !== "PURCHASING_MANAGER") {
    redirect(`/${businessUnitId}/unauthorized`);
  }
  const { status, type, page = "1" } = await searchParams;
  
  // Check if user is the special approver (C-002)
  const isSpecialApprover = session.user.employeeId === 'C-002';
  
  try {
    const pendingRequestsData = await getPendingMaterialRequests({
      businessUnitId,
      status,
      type,
      page: parseInt(page),
      limit: 10
    });
    
    return (
      <div className="space-y-6">
        {isSpecialApprover && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Viewing All Business Units
                </h3>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                  As a final approver, you are viewing material requests from all business units assigned to you.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <PendingMaterialRequestsView 
          requestsData={pendingRequestsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            status,
            type,
            page: parseInt(page)
          }}
          currentUserRole={session.user.role}
          isSpecialApprover={isSpecialApprover}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading pending material requests:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pending Material Request Approvals</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load pending requests. Please try again later.</p>
        </div>
      </div>
    );
  }
}