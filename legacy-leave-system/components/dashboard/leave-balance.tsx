import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { LeaveBalance } from "@/lib/actions/dashboard-actions";

interface LeaveBalanceProps {
  balances: LeaveBalance[];
  businessUnitId: string;
}

export function LeaveBalanceCard({ balances, businessUnitId }: LeaveBalanceProps) {
  // Filter for specific leave types only
  const allowedLeaveTypes = ['SICK', 'VACATION', 'CTO', 'MANDATORY'];
  const filteredBalances = balances.filter(balance => 
    allowedLeaveTypes.some(type => 
      balance.leaveType.name.toUpperCase().includes(type.toUpperCase())
    )
  );

  // Get distinct color for each leave type
  const getLeaveTypeColor = (leaveTypeName: string): string => {
    const lowerName = leaveTypeName.toLowerCase();
    if (lowerName.includes('sick')) return 'bg-red-500';
    if (lowerName.includes('vacation')) return 'bg-blue-500';
    if (lowerName.includes('cto')) return 'bg-purple-500';
    if (lowerName.includes('mandatory')) return 'bg-orange-500';
    return 'bg-gray-500';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Leave Balance ({new Date().getFullYear()})
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${businessUnitId}/leave-balances`}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredBalances.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              No leave balances found
            </p>
            <p className="text-xs text-muted-foreground">
              Contact HR to set up your leave allocations for SICK, VACATION, CTO, and MANDATORY leave
            </p>
          </div>
        ) : (
          filteredBalances.map((balance) => {
            const remainingDays = balance.allocatedDays - balance.usedDays;
            const remainingPercentage = balance.allocatedDays > 0 
              ? (remainingDays / balance.allocatedDays) * 100 
              : 0;
            const colorClass = getLeaveTypeColor(balance.leaveType.name);
            
            return (
              <div key={balance.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{balance.leaveType.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {remainingDays} of {balance.allocatedDays} days remaining
                  </span>
                </div>
                <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${colorClass}`}
                    style={{ width: `${Math.max(0, Math.min(100, remainingPercentage))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Used: {balance.usedDays} days</span>
                  <span>
                    {remainingPercentage < 20 ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {remainingPercentage.toFixed(0)}% remaining
                      </span>
                    ) : remainingPercentage < 50 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {remainingPercentage.toFixed(0)}% remaining
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {remainingPercentage.toFixed(0)}% remaining
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}