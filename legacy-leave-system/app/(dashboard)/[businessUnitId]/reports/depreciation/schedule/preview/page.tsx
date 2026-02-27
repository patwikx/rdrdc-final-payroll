import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDepreciationAnalysis, getDepreciationFilterOptions } from "@/lib/actions/depreciation-reports-actions";
import { DepreciationSchedulePreview } from "@/components/reports/depreciation-schedule-preview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { prisma } from "@/lib/prisma";

interface DepreciationSchedulePreviewPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    departmentId?: string;
    depreciationMethod?: string;
    status?: string;
    isFullyDepreciated?: string;
  }>;
}

export default async function DepreciationSchedulePreviewPage({
  params,
  searchParams
}: DepreciationSchedulePreviewPageProps) {
  const { businessUnitId } = await params;
  const resolvedSearchParams = await searchParams;

  try {
    const filters = {
      startDate: resolvedSearchParams.startDate ? new Date(resolvedSearchParams.startDate) : undefined,
      endDate: resolvedSearchParams.endDate ? new Date(resolvedSearchParams.endDate) : undefined,
      categoryId: resolvedSearchParams.categoryId && resolvedSearchParams.categoryId !== 'all' ? resolvedSearchParams.categoryId : undefined,
      departmentId: resolvedSearchParams.departmentId && resolvedSearchParams.departmentId !== 'all' ? resolvedSearchParams.departmentId : undefined,
      depreciationMethod: resolvedSearchParams.depreciationMethod && resolvedSearchParams.depreciationMethod !== 'all' ? resolvedSearchParams.depreciationMethod as any : undefined,
      status: resolvedSearchParams.status && resolvedSearchParams.status !== 'all' ? resolvedSearchParams.status as any : undefined,
      isFullyDepreciated: resolvedSearchParams.isFullyDepreciated && resolvedSearchParams.isFullyDepreciated !== 'all' 
        ? resolvedSearchParams.isFullyDepreciated === 'true' 
        : undefined,
    };

    const [analysisData, businessUnit] = await Promise.all([
      getDepreciationAnalysis(businessUnitId, filters),
      prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        select: { id: true, name: true }
      })
    ]);

    if (!businessUnit) {
      notFound();
    }

    return (
      <Suspense fallback={<LoadingSpinner />}>
        <DepreciationSchedulePreview
          analysisData={analysisData}
          businessUnit={businessUnit}
          filters={filters}
        />
      </Suspense>
    );
  } catch (error) {
    console.error('Error loading depreciation schedule preview:', error);
    notFound();
  }
}