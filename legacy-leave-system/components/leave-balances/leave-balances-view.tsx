"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  TrendingDown, 
  TrendingUp, 
  Plus,
  AlertCircle
} from "lucide-react";
import { LeaveBalanceWithHistory } from "@/lib/actions/leave-balance-actions";
import { LeaveBalanceCard } from "@/components/leave-balances/leave-balance-card";
import { LeaveHistoryDialog } from "@/components/leave-balances/leave-history-dialog";
import Link from "next/link";

interface LeaveBalancesViewProps {
  leaveBalances: LeaveBalanceWithHistory[];
  businessUnitId: string;
  userId: string;
}

export function LeaveBalancesView({ leaveBalances, businessUnitId, userId }: LeaveBalancesViewProps) {
  const [selectedBalance, setSelectedBalance] = useState<LeaveBalanceWithHistory | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  const handleViewHistory = (balance: LeaveBalanceWithHistory) => {
    setSelectedBalance(balance);
    setHistoryDialogOpen(true);
  };

  const totalEntitlements = leaveBalances.reduce((sum, balance) => sum + balance.totalEntitlement, 0);
  const totalUsed = leaveBalances.reduce((sum, balance) => sum + balance.usedDays, 0);
  const totalRemaining = leaveBalances.reduce((sum, balance) => sum + balance.remainingDays, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entitlement</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEntitlements}</div>
            <p className="text-xs text-muted-foreground">
              Days allocated for this year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Used</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsed}</div>
            <p className="text-xs text-muted-foreground">
              {totalEntitlements > 0 ? Math.round((totalUsed / totalEntitlements) * 100) : 0}% of total entitlement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Days</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRemaining}</div>
            <p className="text-xs text-muted-foreground">
              Available for use
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leave Type Balances */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Leave Type Balances</h2>
          <Button asChild>
            <Link href={`/${businessUnitId}/leave-requests/create`}>
              <Plus className="h-4 w-4 mr-2" />
              Request Leave
            </Link>
          </Button>
        </div>

        {leaveBalances.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Leave Balances Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                You don't have any leave balances set up for this year. 
                Please contact your HR administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leaveBalances.map((balance) => (
              <LeaveBalanceCard
                key={balance.id}
                balance={balance}
                onViewHistory={() => handleViewHistory(balance)}
              />
            ))}
          </div>
        )}
      </div>

      {/* History Dialog */}
      {selectedBalance && (
        <LeaveHistoryDialog
          balance={selectedBalance}
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          userId={userId}
        />
      )}
    </div>
  );
}