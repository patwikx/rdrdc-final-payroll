import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LeaveBalancesView } from "@/components/leave-balances/leave-balances-view";
import { getLeaveBalances } from "@/lib/actions/leave-balance-actions";

interface LeaveBalancesPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function LeaveBalancesPage({ params }: LeaveBalancesPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const { businessUnitId } = await params;
  
  try {
    const leaveBalances = await getLeaveBalances(session.user.id, businessUnitId);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mt-2">Leave Balances</h1>
            <p className="text-muted-foreground">
              View your current leave balances and entitlements
            </p>
          </div>
        </div>

        <LeaveBalancesView 
          leaveBalances={leaveBalances} 
          businessUnitId={businessUnitId}
          userId={session.user.id}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading leave balances:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mt-2">Leave Balances</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load leave balances. Please try again later.</p>
        </div>
      </div>
    );
  }
}