import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDeploymentReportData } from "@/lib/actions/deployment-reports-actions";
import { DeploymentReportPreview } from "@/components/reports/deployment-report-preview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { prisma } from "@/lib/prisma";
import { DeploymentStatus } from "@prisma/client";

interface DeploymentReportPreviewPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    departmentId?: string;
    categoryId?: string;
    status?: string;
    includeReturned?: string;
  }>;
}

export default async function DeploymentReportPreviewPage({
  params,
  searchParams
}: DeploymentReportPreviewPageProps) {
  const { businessUnitId } = await params;
  const resolvedSearchParams = await searchParams;

  try {
    const filters = {
      startDate: resolvedSearchParams.startDate ? new Date(resolvedSearchParams.startDate) : undefined,
      endDate: resolvedSearchParams.endDate ? new Date(resolvedSearchParams.endDate) : undefined,
      employeeId: resolvedSearchParams.employeeId && resolvedSearchParams.employeeId !== 'all' ? resolvedSearchParams.employeeId : undefined,
      departmentId: resolvedSearchParams.departmentId && resolvedSearchParams.departmentId !== 'all' ? resolvedSearchParams.departmentId : undefined,
      categoryId: resolvedSearchParams.categoryId && resolvedSearchParams.categoryId !== 'all' ? resolvedSearchParams.categoryId : undefined,
      status: resolvedSearchParams.status && resolvedSearchParams.status !== 'ALL' ? resolvedSearchParams.status as DeploymentStatus : undefined,
      includeReturned: resolvedSearchParams.includeReturned ? resolvedSearchParams.includeReturned === 'true' : true,
    };

    const [reportData, businessUnit] = await Promise.all([
      getDeploymentReportData(businessUnitId, filters),
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
        <DeploymentReportPreview
          reportData={reportData}
          businessUnit={businessUnit}
          filters={filters}
        />
      </Suspense>
    );
  } catch (error) {
    console.error('Error loading deployment report preview:', error);
    notFound();
  }
}