import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  Plus,
  FileText
} from "lucide-react";
import Link from "next/link";
import type { DashboardStats } from "@/lib/actions/dashboard-actions";

interface StatsCardsProps {
  stats: DashboardStats;
  businessUnitId: string;
}

export function StatsCards({ stats, businessUnitId }: StatsCardsProps) {
  const cards = [
    {
      title: "Request Leave",
      icon: Calendar,
      description: "Submit a new leave request",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      href: `/${businessUnitId}/leave-requests/create`,
      type: "action" as const,
    },
    {
      title: "Request Overtime",
      icon: Clock,
      description: "Submit a new overtime request",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      href: `/${businessUnitId}/overtime-requests/create`,
      type: "action" as const,
    },
    {
      title: "Leave Requests",
      value: stats.totalLeaveRequests,
      icon: Calendar,
      description: `${stats.pendingLeaveRequests} pending approval`,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      type: "stat" as const,
    },
    {
      title: "Overtime Requests",
      value: stats.totalOvertimeRequests,
      icon: Clock,
      description: `${stats.pendingOvertimeRequests} pending approval`,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
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
                      Submit Request
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