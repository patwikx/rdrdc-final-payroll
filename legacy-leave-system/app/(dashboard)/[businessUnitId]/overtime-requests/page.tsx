import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DynamicBreadcrumbs } from "@/components/dynamic-breadcurmbs";
import { OvertimeRequestsView } from "@/components/overtime-requests/overtime-requests-view";
import { getOvertimeRequests } from "@/lib/actions/overtime-request-actions";

interface OvertimeRequestsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function OvertimeRequestsPage({ params, searchParams }: OvertimeRequestsPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const { businessUnitId } = await params;
  const { status, page = "1" } = await searchParams;
  
  try {
    const overtimeRequestsData = await getOvertimeRequests({
      userId: session.user.id,
      businessUnitId,
      status,
      page: parseInt(page),
      limit: 10
    });
    
    return (
      <div className="space-y-6">
        <OvertimeRequestsView 
          overtimeRequestsData={overtimeRequestsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            status,
            page: parseInt(page)
          }}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading overtime requests:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <DynamicBreadcrumbs businessUnitId={businessUnitId} />
            <h1 className="text-3xl font-bold tracking-tight mt-2">Overtime Requests</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load overtime requests. Please try again later.</p>
        </div>
      </div>
    );
  }
}