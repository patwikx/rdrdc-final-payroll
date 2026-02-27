import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { 
  getAssetDashboardStats,
  getAssetStatusDistribution,
  getAssetCategoryStats,
  getRecentAssetActivities,
  getDepreciationSummary,
  getDeploymentStats,
  getAssetTrends
} from "@/lib/actions/asset-dashboard-actions";
import { AssetStatsCards } from "@/components/asset-dashboard/asset-stats-cards";
import { AssetStatusChart } from "@/components/asset-dashboard/asset-status-chart";
import { AssetTrendsChart } from "@/components/asset-dashboard/asset-trends-chart";
import { CategoryStatsTable } from "@/components/asset-dashboard/category-stats-table";
import { RecentActivities } from "@/components/asset-dashboard/recent-activities";
import { DepreciationSummaryCard } from "@/components/asset-dashboard/depreciation-summary";
import { DeploymentStatsCard } from "@/components/asset-dashboard/deployment-stats";

interface AssetManagementDashboardProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function AssetManagementDashboard({ params }: AssetManagementDashboardProps) {
  const session = await auth();
  
  // Redirect if not authenticated
  if (!session?.user) {
    redirect("/");
  }

  const { businessUnitId } = await params;

  // Check if user has access to asset management
  if (session.user.role !== "ADMIN" && !session.user.isAcctg) {
    // Instead of redirecting, show access denied message
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access the Asset Management dashboard.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Only ADMIN and Accounting users can access this section.
          </p>
          <p className="text-xs text-muted-foreground">
            Your current role: <span className="font-medium">{session.user.role}</span>
          </p>
        </div>
      </div>
    );
  }

  try {
    // Fetch all dashboard data in parallel
    const [
      stats,
      statusDistribution,
      categoryStats,
      recentActivities,
      depreciationSummary,
      deploymentStats,
      assetTrends,
    ] = await Promise.all([
      getAssetDashboardStats(businessUnitId),
      getAssetStatusDistribution(businessUnitId),
      getAssetCategoryStats(businessUnitId),
      getRecentAssetActivities(businessUnitId),
      getDepreciationSummary(businessUnitId),
      getDeploymentStats(businessUnitId),
      getAssetTrends(businessUnitId),
    ]);

    return (
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Asset Management Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor and manage your organization's assets, deployments, and depreciation.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {session.user.businessUnit?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {session.user.employeeId} • {session.user.role}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <AssetStatsCards stats={stats} businessUnitId={businessUnitId} />

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AssetStatusChart data={statusDistribution} />
          <AssetTrendsChart data={assetTrends} />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Categories and Activities */}
          <div className="space-y-6">
            <CategoryStatsTable 
              data={categoryStats} 
              businessUnitId={businessUnitId} 
            />
            <RecentActivities 
              data={recentActivities} 
              businessUnitId={businessUnitId} 
            />
          </div>
          
          {/* Right Column - Depreciation and Deployments */}
          <div className="space-y-6">
            <DepreciationSummaryCard 
              data={depreciationSummary} 
              businessUnitId={businessUnitId} 
            />
            <DeploymentStatsCard 
              data={deploymentStats} 
              businessUnitId={businessUnitId} 
            />
          </div>

          {/* Third Column - Additional Stats or Quick Actions */}
          <div className="space-y-6">
            {/* Quick Access Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-lg border">
              <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <a 
                  href={`/${businessUnitId}/asset-management/assets`}
                  className="block p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border"
                >
                  <div className="font-medium text-sm">View All Assets</div>
                  <div className="text-xs text-muted-foreground">Browse and manage assets</div>
                </a>
                <a 
                  href={`/${businessUnitId}/asset-management/deployments`}
                  className="block p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border"
                >
                  <div className="font-medium text-sm">Manage Deployments</div>
                  <div className="text-xs text-muted-foreground">Deploy and track assets</div>
                </a>
                <a 
                  href={`/${businessUnitId}/reports/assets`}
                  className="block p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border"
                >
                  <div className="font-medium text-sm">Asset Reports</div>
                  <div className="text-xs text-muted-foreground">Generate detailed reports</div>
                </a>
                <a 
                  href={`/${businessUnitId}/asset-management/inventory`}
                  className="block p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border"
                >
                  <div className="font-medium text-sm">Inventory Verification</div>
                  <div className="text-xs text-muted-foreground">Verify asset locations</div>
                </a>
              </div>
            </div>

            {/* System Health Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6 rounded-lg border">
              <h3 className="font-semibold text-lg mb-4">System Health</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Asset Data Quality</span>
                  <span className="text-sm font-medium text-green-600">98%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Deployment Accuracy</span>
                  <span className="text-sm font-medium text-green-600">95%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Depreciation Up-to-date</span>
                  <span className="text-sm font-medium text-green-600">100%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Barcode Coverage</span>
                  <span className="text-sm font-medium text-amber-600">87%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Asset dashboard error:", error);
    
    // Show error page for data fetching errors
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Dashboard</h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading the asset management dashboard.
          </p>
          <p className="text-sm text-muted-foreground">
            Please try refreshing the page or contact support if the issue persists.
          </p>
        </div>
      </div>
    );
  }
}