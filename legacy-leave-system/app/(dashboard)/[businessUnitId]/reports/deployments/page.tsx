import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DeploymentTabsWrapper } from "@/components/reports/deployment-tabs-wrapper";
import {
  getDeploymentReportData,
  getDeploymentReportSummary,
  getDeploymentReportFilterOptions,
  DeploymentReportFilters,
} from "@/lib/actions/deployment-reports-actions";
import { prisma } from "@/lib/prisma";
import { DeploymentStatus } from "@prisma/client";

interface DeploymentReportsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    tab?: string;
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    departmentId?: string;
    categoryId?: string;
    status?: string;
    includeReturned?: string;
  }>;
}

async function DeploymentReportsContent({
  businessUnitId,
  searchParams,
}: {
  businessUnitId: string;
  searchParams: {
    tab?: string;
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    departmentId?: string;
    categoryId?: string;
    status?: string;
    includeReturned?: string;
  };
}) {
  // Verify business unit exists
  const businessUnit = await prisma.businessUnit.findUnique({
    where: { id: businessUnitId },
    select: { id: true, name: true },
  });

  if (!businessUnit) {
    redirect("/dashboard");
  }

  // Parse filters from search params
  const filters: DeploymentReportFilters = {
    startDate: searchParams.startDate ? new Date(searchParams.startDate) : undefined,
    endDate: searchParams.endDate ? new Date(searchParams.endDate) : undefined,
    employeeId: searchParams.employeeId && searchParams.employeeId !== 'all' ? searchParams.employeeId : undefined,
    departmentId: searchParams.departmentId && searchParams.departmentId !== 'all' ? searchParams.departmentId : undefined,
    categoryId: searchParams.categoryId && searchParams.categoryId !== 'all' ? searchParams.categoryId : undefined,
    status: searchParams.status && searchParams.status !== 'ALL' ? searchParams.status as DeploymentStatus : undefined,
    includeReturned: searchParams.includeReturned === 'false' ? false : true,
  };

  // Fetch data in parallel
  const [reportData, summaryData, filterOptions] = await Promise.all([
    getDeploymentReportData(businessUnitId, filters),
    getDeploymentReportSummary(businessUnitId, filters),
    getDeploymentReportFilterOptions(businessUnitId),
  ]);

  const activeTab = searchParams.tab || "summary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Deployment Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive asset deployment analysis and reporting for {businessUnit.name}
          </p>
        </div>
      </div>

      <DeploymentTabsWrapper
        activeTab={activeTab}
        businessUnitId={businessUnitId}
        reportData={reportData}
        summaryData={summaryData}
        filterOptions={filterOptions}
        businessUnitName={businessUnit.name}
        currentFilters={filters}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function DeploymentReportsPage({
  params,
  searchParams,
}: DeploymentReportsPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DeploymentReportsContent
        businessUnitId={resolvedParams.businessUnitId}
        searchParams={resolvedSearchParams}
      />
    </Suspense>
  );
}