import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRequestsPendingBudgetApproval } from "@/lib/actions/mrs-actions/material-request-actions";
import { PendingBudgetApprovalsView } from "@/components/approvals/pending-budget-approvals-view";

interface BudgetApprovalsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    search?: string;
  }>;
}

export default async function BudgetApprovalsPage({ 
  params, 
  searchParams 
}: BudgetApprovalsPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  const { businessUnitId } = await params;
  
  // Only accounting users can access budget approvals
  if (!session.user.isAcctg) {
    redirect(`/${businessUnitId}/unauthorized`);
  }
  
  const { search } = await searchParams;
  
  try {
    const requests = await getRequestsPendingBudgetApproval({
      businessUnitId,
      search,
    });
    
    return (
      <div className="space-y-6">
        <PendingBudgetApprovalsView 
          requests={requests}
          businessUnitId={businessUnitId}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading budget approval requests:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pending Budget Approvals</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load budget approval requests. Please try again later.</p>
        </div>
      </div>
    );
  }
}
