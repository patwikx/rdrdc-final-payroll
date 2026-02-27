"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users,
  Download, 
  Filter,
  DollarSign,
  Package,
  Calendar,
  Building2,
  TrendingUp,
  Eye,
  Printer
} from "lucide-react";
import { DeploymentReportSummary, DeploymentReportData, DeploymentReportFilters } from "@/lib/actions/deployment-reports-actions";
import { DeploymentStatus } from "@prisma/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface DeploymentAnalysisViewProps {
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
  businessUnitId: string;
  businessUnitName?: string;
  currentFilters: DeploymentReportFilters;
}

const STATUS_COLORS: Record<string, string> = {
  [DeploymentStatus.PENDING_ACCOUNTING_APPROVAL]: "#f59e0b",
  [DeploymentStatus.DEPLOYED]: "#3b82f6",
  [DeploymentStatus.RETURNED]: "#10b981",
  APPROVED: "#10b981",
  CANCELLED: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  [DeploymentStatus.PENDING_ACCOUNTING_APPROVAL]: "Pending Approval",
  [DeploymentStatus.DEPLOYED]: "Deployed",
  [DeploymentStatus.RETURNED]: "Returned",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

export function DeploymentAnalysisView({
  reportData,
  summaryData,
  filterOptions,
  businessUnitId,
  businessUnitName,
  currentFilters
}: DeploymentAnalysisViewProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Prepare chart data
  const statusDistribution = Object.values(DeploymentStatus).map(status => {
    const count = reportData.filter(d => d.status === status).length;
    return {
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || "#6b7280",
    };
  }).filter(item => item.value > 0);

  const departmentChartData = summaryData.departmentBreakdown.slice(0, 10).map(dept => ({
    name: dept.departmentName.length > 15 ? dept.departmentName.substring(0, 15) + '...' : dept.departmentName,
    deployments: dept.count,
    value: dept.totalValue,
  }));

  const categoryChartData = summaryData.categoryBreakdown.slice(0, 8).map(cat => ({
    name: cat.categoryName.length > 15 ? cat.categoryName.substring(0, 15) + '...' : cat.categoryName,
    deployments: cat.count,
    value: cat.totalValue,
  }));

  const viewDetailedReport = () => {
    const params = new URLSearchParams();
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== 'all' && value !== 'ALL') {
        if (value instanceof Date) {
          params.set(key, value.toISOString().split('T')[0]);
        } else {
          params.set(key, value.toString());
        }
      }
    });
    params.set('tab', 'detailed');
    router.push(`/${businessUnitId}/reports/deployments?${params.toString()}`);
  };

  const viewPrintableReport = () => {
    const params = new URLSearchParams();
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== 'all' && value !== 'ALL') {
        if (value instanceof Date) {
          params.set(key, value.toISOString().split('T')[0]);
        } else {
          params.set(key, value.toString());
        }
      }
    });
    router.push(`/${businessUnitId}/reports/deployments/preview?${params.toString()}`);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Count: {data.value || data.deployments}
          </p>
          {data.value && (
            <p className="text-sm text-muted-foreground">
              Value: ₱{formatCurrency(data.value)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Analysis Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deployment Analysis</h2>
          <p className="text-muted-foreground">
            Visual analysis and insights for asset deployments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={viewDetailedReport}>
            <Eye className="h-4 w-4 mr-2" />
            View Detailed Report
          </Button>
          <Button onClick={viewPrintableReport}>
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployment Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryData.totalDeployments > 0 
                ? Math.round((summaryData.activeDeployments / summaryData.totalDeployments) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {summaryData.activeDeployments} of {summaryData.totalDeployments} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryData.totalDeployments > 0 
                ? Math.round((summaryData.returnedDeployments / summaryData.totalDeployments) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {summaryData.returnedDeployments} assets returned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Asset Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₱{formatCurrency(summaryData.totalDeployments > 0 ? summaryData.totalAssetValue / summaryData.totalDeployments : 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              per deployment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.departmentBreakdown.length}</div>
            <p className="text-xs text-muted-foreground">
              with deployments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Deployment Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Distribution */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Deployments by Department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  className="text-xs fill-muted-foreground"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis className="text-xs fill-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="deployments" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Analysis */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Asset Category Analysis</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                className="text-xs fill-muted-foreground"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis className="text-xs fill-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="deployments" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Top Departments by Value</h3>
          <div className="space-y-4">
            {summaryData.departmentBreakdown.slice(0, 5).map((dept, index) => (
              <div key={dept.departmentName} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{dept.departmentName}</p>
                    <p className="text-sm text-muted-foreground">{dept.count} deployments</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">₱{formatCurrency(dept.totalValue)}</p>
                  <p className="text-xs text-muted-foreground">
                    ₱{formatCurrency(dept.count > 0 ? dept.totalValue / dept.count : 0)} avg
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Top Categories by Count</h3>
          <div className="space-y-4">
            {summaryData.categoryBreakdown.slice(0, 5).map((category, index) => (
              <div key={category.categoryName} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-medium text-green-600 dark:text-green-400">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{category.categoryName}</p>
                    <p className="text-sm text-muted-foreground">₱{formatCurrency(category.totalValue)}</p>
                  </div>
                </div>
                <Badge variant="secondary">{category.count} assets</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}