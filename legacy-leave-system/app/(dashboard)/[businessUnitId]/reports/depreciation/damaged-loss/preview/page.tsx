import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDamagedLossReportData } from "@/lib/actions/damaged-loss-reports-actions";
import { DamagedLossPreview } from "@/components/reports/damaged-loss-preview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { prisma } from "@/lib/prisma";

interface DamagedLossPreviewPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    departmentId?: string;
    status?: string;
    disposalReason?: string;
    includeDisposed?: string;
  }>;
}

export default async function DamagedLossPreviewPage({
  params,
  searchParams
}: DamagedLossPreviewPageProps) {
  const { businessUnitId } = await params;
  const resolvedSearchParams = await searchParams;

  try {
    const filters = {
      startDate: resolvedSearchParams.startDate ? new Date(resolvedSearchParams.startDate) : undefined,
      endDate: resolvedSearchParams.endDate ? new Date(resolvedSearchParams.endDate) : undefined,
      categoryId: resolvedSearchParams.categoryId && resolvedSearchParams.categoryId !== 'all' ? resolvedSearchParams.categoryId : undefined,
      departmentId: resolvedSearchParams.departmentId && resolvedSearchParams.departmentId !== 'all' ? resolvedSearchParams.departmentId : undefined,
      status: resolvedSearchParams.status && resolvedSearchParams.status !== 'all' ? resolvedSearchParams.status as any : undefined,
      disposalReason: resolvedSearchParams.disposalReason && resolvedSearchParams.disposalReason !== 'all' ? resolvedSearchParams.disposalReason as any : undefined,
      includeDisposed: resolvedSearchParams.includeDisposed === 'true',
    };

    const [reportData, businessUnit] = await Promise.all([
      getDamagedLossReportData(businessUnitId, filters),
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
        <DamagedLossPreview
          reportData={reportData}
          businessUnit={businessUnit}
          filters={filters}
        />
      </Suspense>
    );
  } catch (error) {
    console.error('Error loading damaged & loss report preview:', error);
    notFound();
  }
}