import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getOvertimeReports, getReportFilterOptions, getBusinessUnitNameForReports } from "@/lib/actions/reports-actions";
import { OvertimeReportsView } from "@/components/reports/overtime-reports-view";

interface OvertimeReportsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    departmentId?: string;
    userId?: string;
  }>;
}

export default async function OvertimeReportsPage({ 
  params, 
  searchParams 
}: OvertimeReportsPageProps) {
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
    userId: resolvedSearchParams.userId
  };
  
  try {
    const [overtimeReports, filterOptions, businessUnitName] = await Promise.all([
      getOvertimeReports(resolvedParams.businessUnitId, filters),
      getReportFilterOptions(resolvedParams.businessUnitId),
      getBusinessUnitNameForReports(resolvedParams.businessUnitId)
    ]);
    
    return (
      <OvertimeReportsView
        overtimeReports={overtimeReports}
        filterOptions={filterOptions}
        businessUnitId={resolvedParams.businessUnitId}
        businessUnitName={businessUnitName || undefined}
        currentFilters={filters}
      />
    );
  } catch (error) {
    console.error("Error loading overtime reports:", error);
    redirect(`/${resolvedParams.businessUnitId}`);
  }
}