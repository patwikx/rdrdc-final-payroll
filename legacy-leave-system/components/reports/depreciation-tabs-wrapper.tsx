"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepreciationSummaryView } from "@/components/reports/depreciation-summary-view";
import { DepreciationAnalysisView } from "@/components/reports/depreciation-analysis-view";
import { DepreciationScheduleView } from "@/components/reports/depreciation-schedule-view";
import { AssetsNetBookValueView } from "@/components/reports/assets-net-book-value-view";
import { DamagedLossView } from "@/components/reports/damaged-loss-view";
import { Calculator, PieChart, FileText, DollarSign, AlertTriangle } from "lucide-react";
import type { DepreciationSummaryData, DepreciationAnalysisData, DepreciationFilters } from "@/lib/actions/depreciation-reports-actions";

interface DepreciationTabsWrapperProps {
  activeTab: string;
  businessUnitId: string;
  summaryData: DepreciationSummaryData;
  analysisData: DepreciationAnalysisData[];
  filterOptions: {
    categories: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    depreciationMethods: { value: string; label: string }[];
    assetStatuses: { value: string; label: string }[];
  };
  businessUnitName: string;
  currentFilters: DepreciationFilters;
  damagedLossData?: any[];
  damagedLossFilterOptions?: {
    categories: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    assetStatuses: { value: string; label: string }[];
    disposalReasons: { value: string; label: string }[];
  };
}

export function DepreciationTabsWrapper({
  activeTab,
  businessUnitId,
  summaryData,
  analysisData,
  filterOptions,
  businessUnitName,
  currentFilters,
  damagedLossData = [],
  damagedLossFilterOptions,
}: DepreciationTabsWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/${businessUnitId}/reports/depreciation?${params.toString()}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="summary" className="flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Summary Dashboard
        </TabsTrigger>
        <TabsTrigger value="analysis" className="flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Detailed Analysis
        </TabsTrigger>
        <TabsTrigger value="schedule" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Schedule Report
        </TabsTrigger>
        <TabsTrigger value="netbook" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Net Book Value
        </TabsTrigger>
        <TabsTrigger value="damaged-loss" className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Damaged & Loss
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-6">
        <DepreciationSummaryView
          summaryData={summaryData}
          filterOptions={filterOptions}
          businessUnitId={businessUnitId}
          businessUnitName={businessUnitName}
          currentFilters={currentFilters}
        />
      </TabsContent>

      <TabsContent value="analysis" className="space-y-6">
        <DepreciationAnalysisView
          analysisData={analysisData}
          filterOptions={filterOptions}
          businessUnitId={businessUnitId}
          businessUnitName={businessUnitName}
          currentFilters={currentFilters}
        />
      </TabsContent>

      <TabsContent value="schedule" className="space-y-6">
        <DepreciationScheduleView
          analysisData={analysisData}
          filterOptions={filterOptions}
          businessUnitId={businessUnitId}
          currentFilters={currentFilters}
        />
      </TabsContent>

      <TabsContent value="netbook" className="space-y-6">
        <AssetsNetBookValueView
          analysisData={analysisData}
          filterOptions={filterOptions}
          businessUnitId={businessUnitId}
          currentFilters={currentFilters}
        />
      </TabsContent>

      <TabsContent value="damaged-loss" className="space-y-6">
        <DamagedLossView
          reportData={damagedLossData}
          filterOptions={damagedLossFilterOptions || {
            categories: filterOptions.categories,
            departments: filterOptions.departments,
            assetStatuses: [
              { value: 'LOST', label: 'Lost' },
              { value: 'DAMAGED', label: 'Damaged' },
              { value: 'DISPOSED', label: 'Disposed' },
            ],
            disposalReasons: [
              { value: 'LOST', label: 'Lost' },
              { value: 'STOLEN', label: 'Stolen' },
              { value: 'DAMAGED_BEYOND_REPAIR', label: 'Damaged Beyond Repair' },
              { value: 'SCRAPPED', label: 'Scrapped' },
              { value: 'END_OF_LIFE', label: 'End of Life' },
              { value: 'OBSOLETE', label: 'Obsolete' },
            ],
          }}
          businessUnitId={businessUnitId}
          currentFilters={{
            startDate: currentFilters.startDate,
            endDate: currentFilters.endDate,
            categoryId: currentFilters.categoryId,
            departmentId: currentFilters.departmentId,
          }}
        />
      </TabsContent>
    </Tabs>
  );
}