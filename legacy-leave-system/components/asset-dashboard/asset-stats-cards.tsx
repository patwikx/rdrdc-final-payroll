"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  PackageCheck, 
  PackageX, 
  Wrench,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity
} from "lucide-react";
import Link from "next/link";
import type { AssetDashboardStats } from "@/lib/actions/asset-dashboard-actions";

interface AssetStatsCardsProps {
  stats: AssetDashboardStats;
  businessUnitId: string;
}

export function AssetStatsCards({ stats, businessUnitId }: AssetStatsCardsProps) {
  const cards = [
    {
      title: "Add New Asset",
      icon: Package,
      description: "Register a new asset",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      href: `/${businessUnitId}/asset-management/assets/create`,
      type: "action" as const,
    },
    {
      title: "Deploy Asset",
      icon: PackageCheck,
      description: "Deploy asset to employee",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      href: `/${businessUnitId}/asset-management/deployments`,
      type: "action" as const,
    },
    {
      title: "Total Assets",
      value: stats.totalAssets.toLocaleString(),
      icon: Package,
      description: `${stats.activeAssets} active assets`,
      color: "text-slate-600 dark:text-slate-400",
      bgColor: "bg-slate-50 dark:bg-slate-950/20",
      type: "stat" as const,
    },
    {
      title: "Available",
      value: stats.availableAssets.toLocaleString(),
      icon: PackageCheck,
      description: "Ready for deployment",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      type: "stat" as const,
    },
    {
      title: "Deployed",
      value: stats.deployedAssets.toLocaleString(),
      icon: Activity,
      description: "Currently in use",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      type: "stat" as const,
    },
    {
      title: "Maintenance",
      value: stats.maintenanceAssets.toLocaleString(),
      icon: Wrench,
      description: "Under maintenance",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      type: "stat" as const,
    },
    {
      title: "Total Value",
      value: `₱${stats.totalValue.toLocaleString()}`,
      icon: DollarSign,
      description: "Original purchase value",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
      type: "stat" as const,
    },
    {
      title: "Current Value",
      value: `₱${stats.depreciatedValue.toLocaleString()}`,
      icon: TrendingDown,
      description: "After depreciation",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      type: "stat" as const,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        
        if (card.type === "action") {
          return (
            <Card key={card.title} className="hover:shadow-md transition-shadow">
              <Link href={card.href!}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${card.bgColor}`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-4">
                    <Button variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      {card.title}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {card.description}
                  </p>
                </CardContent>
              </Link>
            </Card>
          );
        }

        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}