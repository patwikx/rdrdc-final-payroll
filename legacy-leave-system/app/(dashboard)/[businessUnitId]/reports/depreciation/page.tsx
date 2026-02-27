import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DepreciationTabsWrapper } from "@/components/reports/depreciation-tabs-wrapper";
import {
  getDepreciationSummary,
  getDepreciationAnalysis,
  getDepreciationFilterOptions,
  DepreciationFilters,
} from "@/lib/actions/depreciation-reports-actions";
import {
  getDamagedLossReportData,
  getDamagedLossFilterOptions,
} from "@/lib/actions/damaged-loss-reports-actions";
import { prisma } from "@/lib/prisma";

interface DepreciationReportsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    tab?: string;
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    departmentId?: string;
    depreciationMethod?: string;
    status?: string;
    isFullyDepreciated?: string;
    includeDisposed?: string;
  }>;
}

async function DepreciationReportsContent({
  businessUnitId,
  searchParams,
}: {
  businessUnitId: string;
  searchParams: {
    tab?: string;
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    departmentId?: string;
    depreciationMethod?: string;
    status?: string;
    isFullyDepreciated?: string;
    includeDisposed?: string;
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
  const filters: DepreciationFilters = {
    startDate: searchParams.startDate ? new Date(searchParams.startDate) : undefined,
    endDate: searchParams.endDate ? new Date(searchParams.endDate) : undefined,
    categoryId: searchParams.categoryId && searchParams.categoryId !== 'all' ? searchParams.categoryId : undefined,
    departmentId: searchParams.departmentId && searchParams.departmentId !== 'all' ? searchParams.departmentId : undefined,
    depreciationMethod: searchParams.depreciationMethod && searchParams.depreciationMethod !== 'all' ? 
                       searchParams.depreciationMethod as any : undefined,
    status: searchParams.status && searchParams.status !== 'all' ? 
           searchParams.status as any : undefined,
    isFullyDepreciated: searchParams.isFullyDepreciated === 'true' ? true : 
                       searchParams.isFullyDepreciated === 'false' ? false : undefined,
  };

  // Fetch data in parallel
  const [summaryData, analysisData, filterOptions, damagedLossData, damagedLossFilterOptions] = await Promise.all([
    getDepreciationSummary(businessUnitId, filters),
    getDepreciationAnalysis(businessUnitId, filters),
    getDepreciationFilterOptions(businessUnitId),
    getDamagedLossReportData(businessUnitId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      categoryId: filters.categoryId,
      departmentId: filters.departmentId,
      includeDisposed: searchParams.includeDisposed === 'true',
    }),
    getDamagedLossFilterOptions(businessUnitId),
  ]);

  const activeTab = searchParams.tab || "summary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Depreciation Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive asset depreciation analysis and reporting for {businessUnit.name}
          </p>
        </div>
      </div>

      <DepreciationTabsWrapper
        activeTab={activeTab}
        businessUnitId={businessUnitId}
        summaryData={summaryData}
        analysisData={analysisData}
        filterOptions={filterOptions}
        businessUnitName={businessUnit.name}
        currentFilters={filters}
        damagedLossData={damagedLossData}
        damagedLossFilterOptions={damagedLossFilterOptions}
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
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

export default async function DepreciationReportsPage({
  params,
  searchParams,
}: DepreciationReportsPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DepreciationReportsContent
        businessUnitId={resolvedParams.businessUnitId}
        searchParams={resolvedSearchParams}
      />
    </Suspense>
  );
}