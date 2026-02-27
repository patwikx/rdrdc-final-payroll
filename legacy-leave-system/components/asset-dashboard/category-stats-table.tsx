"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import Link from "next/link";
import type { AssetCategoryStats } from "@/lib/actions/asset-dashboard-actions";

interface CategoryStatsTableProps {
  data: AssetCategoryStats[];
  businessUnitId: string;
}

export function CategoryStatsTable({ data, businessUnitId }: CategoryStatsTableProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No categories found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Asset Categories</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${businessUnitId}/asset-management/categories`}>
            View All
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.slice(0, 6).map((category) => (
            <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{category.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {category.code}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{category.count} assets</span>
                  <span>₱{category.totalValue.toLocaleString()} total</span>
                  <span>₱{category.averageValue.toLocaleString()} avg</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${businessUnitId}/asset-management/categories/${category.id}`}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}