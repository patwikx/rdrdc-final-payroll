"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { AssetStatusDistribution } from "@/lib/actions/asset-dashboard-actions";

interface AssetStatusChartProps {
  data: AssetStatusDistribution[];
}

const STATUS_COLORS = {
  AVAILABLE: "#10b981", // green
  DEPLOYED: "#3b82f6", // blue
  IN_MAINTENANCE: "#f59e0b", // amber
  RETIRED: "#6b7280", // gray
  DISPOSED: "#ef4444", // red
  DAMAGED: "#dc2626", // red-600
  LOST: "#991b1b", // red-800
  FULLY_DEPRECIATED: "#9ca3af", // gray-400
};

const STATUS_LABELS = {
  AVAILABLE: "Available",
  DEPLOYED: "Deployed",
  IN_MAINTENANCE: "Maintenance",
  RETIRED: "Retired",
  DISPOSED: "Disposed",
  DAMAGED: "Damaged",
  LOST: "Lost",
  FULLY_DEPRECIATED: "Fully Depreciated",
};

export function AssetStatusChart({ data }: AssetStatusChartProps) {
  const chartData = data.map(item => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    percentage: item.percentage,
    color: STATUS_COLORS[item.status] || "#6b7280",
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Count: {data.value.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Percentage: {data.percentage.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No asset data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}