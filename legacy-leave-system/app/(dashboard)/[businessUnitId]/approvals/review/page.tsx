import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPendingReviewRequests } from "@/lib/actions/mrs-actions/material-request-approval-actions";
import { PendingReviewView } from "@/components/approvals/pending-review-view";

interface PendingReviewPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function PendingReviewPage({ 
  params, 
  searchParams 
}: PendingReviewPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  const { businessUnitId } = await params;
  
  // Only R-033 can access this page (Requirement 2.3, 5.3)
  if (session.user.employeeId !== 'R-033') {
    redirect(`/${businessUnitId}/unauthorized`);
  }
  
  const { page = "1" } = await searchParams;
  
  try {
    const pendingReviewData = await getPendingReviewRequests({
      businessUnitId,
      page: parseInt(page),
      limit: 10
    });
    
    return (
      <div className="space-y-6">
        <PendingReviewView 
          requestsData={pendingReviewData}
          businessUnitId={businessUnitId}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading pending review requests:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pending Store Use Reviews</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load pending reviews. Please try again later.</p>
        </div>
      </div>
    );
  }
}
