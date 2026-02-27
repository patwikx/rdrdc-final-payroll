import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getEmployeeReports, getReportFilterOptions, getBusinessUnitNameForReports } from "@/lib/actions/reports-actions";
import { EmployeeReportsView } from "@/components/reports/employee-reports-view";

interface EmployeeReportsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    departmentId?: string;
    userId?: string;
    year?: string;
  }>;
}

export default async function EmployeeReportsPage({ 
  params, 
  searchParams 
}: EmployeeReportsPageProps) {
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
    departmentId: resolvedSearchParams.departmentId,
    userId: resolvedSearchParams.userId,
    year: resolvedSearchParams.year ? parseInt(resolvedSearchParams.year) : undefined
  };
  
  try {
    const [employeeReports, filterOptions, businessUnitName] = await Promise.all([
      getEmployeeReports(resolvedParams.businessUnitId, filters),
      getReportFilterOptions(resolvedParams.businessUnitId),
      getBusinessUnitNameForReports(resolvedParams.businessUnitId)
    ]);
    
    return (
      <EmployeeReportsView
        employeeReports={employeeReports}
        filterOptions={filterOptions}
        businessUnitId={resolvedParams.businessUnitId}
        businessUnitName={businessUnitName || undefined}
        currentFilters={filters}
      />
    );
  } catch (error) {
    console.error("Error loading employee reports:", error);
    redirect(`/${resolvedParams.businessUnitId}`);
  }
}