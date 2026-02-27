"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeploymentSummaryView } from "./deployment-summary-view";
import { DeploymentAnalysisView } from "./deployment-analysis-view";
import { DeploymentDetailedView } from "./deployment-detailed-view";
import { PieChart, FileText, Users, List } from "lucide-react";
import type { 
  DeploymentReportData, 
  DeploymentReportSummary, 
  DeploymentReportFilters 
} from "@/lib/actions/deployment-reports-actions";

interface DeploymentTabsWrapperProps {
  activeTab: string;
  businessUnitId: string;
  reportData: DeploymentReportData[];
  summaryData: DeploymentReportSummary;
  filterOptions: {
    employees: Array<{
      id: string;
      name: string;
      employeeId: string;
    }>;
    departments: Array<{
      id: string;
      name: string;
    }>;
    categories: Array<{
      id: string;
      name: string;
      code: string;
    }>;
  };
  businessUnitName: string;
  currentFilters: DeploymentReportFilters;
}

export function DeploymentTabsWrapper({
  activeTab,
  businessUnitId,
  reportData,
  summaryData,
  filterOptions,
  businessUnitName,
  currentFilters,
}: DeploymentTabsWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/${businessUnitId}/reports/deployments?${params.toString()}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="summary" className="flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Summary Dashboard
        </TabsTrigger>
        <TabsTrigger value="analysis" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Analysis Report
        </TabsTrigger>
        <TabsTrigger value="detailed" className="flex items-center gap-2">
          <List className="h-4 w-4" />
          Detailed Report
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-6">
        <DeploymentSummaryView
          summaryData={summaryData}
          reportData={reportData}
          filterOptions={filterOptions}
          businessUnitId={businessUnitId}
          businessUnitName={businessUnitName}
          currentFilters={currentFilters}
        />
      </TabsContent>

      <TabsContent value="analysis" className="space-y-6">
        <DeploymentAnalysisView
          reportData={reportData}
          summaryData={summaryData}
          filterOptions={filterOptions}
          businessUnitId={businessUnitId}
          businessUnitName={businessUnitName}
          currentFilters={currentFilters}
        />
      </TabsContent>

      <TabsContent value="detailed" className="space-y-6">
        <DeploymentDetailedView
          reportData={reportData}
          filterOptions={filterOptions}
          businessUnitId={businessUnitId}
          currentFilters={currentFilters}
        />
      </TabsContent>
    </Tabs>
  );
}