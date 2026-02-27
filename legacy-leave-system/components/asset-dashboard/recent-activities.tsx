"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  PackageCheck, 
  PackageX, 
  Wrench, 
  Trash2,
  ArrowRight,
  Clock
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { RecentAssetActivity } from "@/lib/actions/asset-dashboard-actions";

interface RecentActivitiesProps {
  data: RecentAssetActivity[];
  businessUnitId: string;
}

const ACTION_ICONS = {
  CREATED: Package,
  DEPLOYED: PackageCheck,
  RETURNED: ArrowRight,
  MAINTENANCE: Wrench,
  DISPOSED: Trash2,
  RETIRED: PackageX,
  UPDATED: Package,
  DEPRECIATION_CALCULATED: Clock,
};

const ACTION_COLORS = {
  CREATED: "bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400",
  DEPLOYED: "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400",
  RETURNED: "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400",
  MAINTENANCE: "bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400",
  DISPOSED: "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400",
  RETIRED: "bg-gray-50 text-gray-600 dark:bg-gray-950/20 dark:text-gray-400",
  UPDATED: "bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400",
  DEPRECIATION_CALCULATED: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400",
};

const ACTION_LABELS = {
  CREATED: "Created",
  DEPLOYED: "Deployed",
  RETURNED: "Returned",
  MAINTENANCE: "Maintenance",
  DISPOSED: "Disposed",
  RETIRED: "Retired",
  UPDATED: "Updated",
  DEPRECIATION_CALCULATED: "Depreciation",
};

export function RecentActivities({ data, businessUnitId }: RecentActivitiesProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No recent activities
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Activities</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${businessUnitId}/admin/audit-logs`}>
            View All
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((activity) => {
            const Icon = ACTION_ICONS[activity.action as keyof typeof ACTION_ICONS] || Package;
            const colorClass = ACTION_COLORS[activity.action as keyof typeof ACTION_COLORS] || ACTION_COLORS.UPDATED;
            const actionLabel = ACTION_LABELS[activity.action as keyof typeof ACTION_LABELS] || activity.action;
            
            return (
              <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      {actionLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.performedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">
                    {activity.assetCode} - {activity.assetDescription}
                  </p>
                  {activity.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {activity.notes}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    by {activity.performedBy}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}