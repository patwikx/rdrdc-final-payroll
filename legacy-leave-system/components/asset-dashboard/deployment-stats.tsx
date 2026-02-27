"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  PackageCheck, 
  Clock,
  ArrowRight,
  Building2
} from "lucide-react";
import Link from "next/link";
import type { DeploymentStats } from "@/lib/actions/asset-dashboard-actions";

interface DeploymentStatsProps {
  data: DeploymentStats;
  businessUnitId: string;
}

export function DeploymentStatsCard({ data, businessUnitId }: DeploymentStatsProps) {
  const deploymentRate = data.totalDeployments > 0 
    ? (data.activeDeployments / data.totalDeployments) * 100 
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-blue-600" />
          Deployment Overview
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${businessUnitId}/asset-management/deployments`}>
            <Users className="h-4 w-4 mr-2" />
            Manage
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Deployment Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Active</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {data.activeDeployments}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {data.pendingApproval}
            </p>
          </div>
        </div>

        {/* Deployment Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Deployment Rate</span>
            <span className="text-sm text-muted-foreground">
              {deploymentRate.toFixed(1)}%
            </span>
          </div>
          <Progress value={deploymentRate} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {data.activeDeployments} of {data.totalDeployments} deployed
            </span>
          </div>
        </div>

        {/* Pending Returns */}
        {data.pendingReturn > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Pending Returns
                </span>
              </div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {data.pendingReturn}
              </Badge>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Assets awaiting return processing
            </p>
          </div>
        )}

        {/* Top Departments */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium">Top Departments</span>
          </div>
          <div className="space-y-2">
            {data.topDepartments.slice(0, 3).map((dept, index) => (
              <div key={dept.departmentName} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {dept.departmentName}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ 
                        width: `${data.activeDeployments > 0 ? (dept.count / data.activeDeployments) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">
                    {dept.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/${businessUnitId}/asset-management/deployments/create`}>
              New Deployment
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/${businessUnitId}/asset-management/returns`}>
              Returns
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}