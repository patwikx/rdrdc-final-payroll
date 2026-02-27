"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Eye,
  Heart,
  Sun,
  Clock,
  AlertTriangle,
  Briefcase
} from "lucide-react";
import { LeaveBalanceWithHistory } from "@/lib/actions/leave-balance-actions";

interface LeaveBalanceCardProps {
  balance: LeaveBalanceWithHistory;
  onViewHistory: () => void;
}

function getLeaveTypeIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('sick')) return Heart;
  if (lowerName.includes('vacation')) return Sun;
  if (lowerName.includes('cto')) return Clock;
  if (lowerName.includes('mandatory')) return AlertTriangle;
  return Briefcase;
}

function formatRequestStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'PENDING_MANAGER':
    case 'PENDING_HR':
    case 'PENDING':
      return 'Pending Approval';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}

export function LeaveBalanceCard({ balance, onViewHistory }: LeaveBalanceCardProps) {
  const Icon = getLeaveTypeIcon(balance.leaveType.name);
  const usagePercentage = balance.totalEntitlement > 0 
    ? Math.round((balance.usedDays / balance.totalEntitlement) * 100) 
    : 0;

  const getStatusBadge = () => {
    if (balance.remainingDays <= 0) {
      return <Badge variant="destructive">Exhausted</Badge>;
    }
    if (balance.remainingDays <= 2) {
      return <Badge variant="secondary">Low Balance</Badge>;
    }
    return <Badge variant="default">Available</Badge>;
  };

  const getExcessBadge = () => {
    if (balance.remainingDays > 20) {
      return (
        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          Excess
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{balance.leaveType.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {getExcessBadge()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Balance Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Used</span>
            <span className="font-medium">{balance.usedDays} / {balance.totalEntitlement}</span>
          </div>
          <Progress 
            value={usagePercentage} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{usagePercentage}% used</span>
            <span>{balance.remainingDays} remaining</span>
          </div>
        </div>

        {/* Recent Activity */}
        {balance.recentRequests.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Requests</h4>
            <div className="space-y-1">
              {balance.recentRequests.slice(0, 2).map((request) => (
                <div key={request.id} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    {new Date(request.startDate).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>{request.days} days</span>
                    <Badge 
                      variant={request.status === 'APPROVED' ? 'default' : 
                              request.status.includes('PENDING') ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {formatRequestStatus(request.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={onViewHistory}
          >
            <Eye className="h-4 w-4 mr-2" />
            View History
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}