import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLeaveReports, getReportFilterOptions, getBusinessUnitNameForReports } from "@/lib/actions/reports-actions";
import { LeaveReportsView } from "@/components/reports/leave-reports-view";

interface LeaveReportsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    departmentId?: string;
    leaveTypeId?: string;
    userId?: string;
  }>;
}

export default async function LeaveReportsPage({ 
  params, 
  searchParams 
}: LeaveReportsPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  // Only admins and HR can access reports
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    redirect(`/${resolvedParams.businessUnitId}`);
  }
  
  const filters = {
    startDate: resolvedSearchParams.startDate ? new Date(resolvedSearchParams.startDate) : undefined,
    endDate: resolvedSearchParams.endDate ? new Date(resolvedSearchParams.endDate) : undefined,
    departmentId: resolvedSearchParams.departmentId,
    leaveTypeId: resolvedSearchParams.leaveTypeId,
    userId: resolvedSearchParams.userId
  };
  
  try {
    const [leaveReports, filterOptions, businessUnitName] = await Promise.all([
      getLeaveReports(resolvedParams.businessUnitId, filters),
      getReportFilterOptions(resolvedParams.businessUnitId),
      getBusinessUnitNameForReports(resolvedParams.businessUnitId)
    ]);
    
    return (
      <LeaveReportsView
        leaveReports={leaveReports}
        filterOptions={filterOptions}
        businessUnitId={resolvedParams.businessUnitId}
        businessUnitName={businessUnitName || undefined}
        currentFilters={filters}
      />
    );
  } catch (error) {
    console.error("Error loading leave reports:", error);
    redirect(`/${resolvedParams.businessUnitId}`);
  }
}