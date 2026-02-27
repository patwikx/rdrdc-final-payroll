"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar,
  Clock,
  FileText,
  Loader2
} from "lucide-react";
import { LeaveBalanceWithHistory, getLeaveBalanceHistory } from "@/lib/actions/leave-balance-actions";
import { format } from "date-fns";

interface LeaveHistoryDialogProps {
  balance: LeaveBalanceWithHistory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

interface LeaveHistoryData {
  balance: {
    id: string;
    leaveType: {
      id: string;
      name: string;
    };
    totalEntitlement: number;
    usedDays: number;
    remainingDays: number;
    year: number;
  } | null;
  requests: {
    id: string;
    startDate: Date;
    endDate: Date;
    days: number;
    status: string;
    session: string;
    reason: string;
  }[];
}

export function LeaveHistoryDialog({ balance, open, onOpenChange, userId }: LeaveHistoryDialogProps) {
  const [historyData, setHistoryData] = useState<LeaveHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (open && balance) {
      loadHistory();
    }
  }, [open, balance, selectedYear]);

  const loadHistory = async () => {
    if (!balance) return;
    
    setLoading(true);
    try {
      const data = await getLeaveBalanceHistory(
        userId || '', // Pass the actual userId
        balance.leaveType.id,
        selectedYear
      );
      setHistoryData(data);
    } catch (error) {
      console.error("Error loading leave history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatRequestStatus = (status: string): string => {
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
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'PENDING_MANAGER':
      case 'PENDING_HR':
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getSessionDisplay = (session: string) => {
    switch (session.toUpperCase()) {
      case 'MORNING':
        return 'Morning (0.5 day)';
      case 'AFTERNOON':
        return 'Afternoon (0.5 day)';
      default:
        return 'Full Day';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {balance.leaveType.name} - Leave History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Year:</span>
            <div className="flex gap-1">
              {[2023, 2024, 2025].map((year) => (
                <Button
                  key={year}
                  variant={selectedYear === year ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedYear(year)}
                >
                  {year}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading history...</span>
            </div>
          ) : (
            <>
              {/* Balance Summary */}
              {historyData?.balance && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{historyData.balance.totalEntitlement}</div>
                    <div className="text-xs text-muted-foreground">Total Entitlement</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{historyData.balance.usedDays}</div>
                    <div className="text-xs text-muted-foreground">Days Used</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{historyData.balance.remainingDays}</div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                  </div>
                </div>
              )}

              {/* Request History */}
              <div className="space-y-2">
                <h4 className="font-medium">Request History</h4>
                <ScrollArea className="h-[300px]">
                  {historyData?.requests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No leave requests found for {selectedYear}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyData?.requests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(request.startDate), 'MMM dd')} - {format(new Date(request.endDate), 'MMM dd, yyyy')}
                              </span>
                            </div>
                            <Badge className={getStatusColor(request.status)}>
                              {formatRequestStatus(request.status)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {getSessionDisplay(request.session)}
                            </div>
                            <div>
                              {request.days} {request.days === 1 ? 'day' : 'days'}
                            </div>
                          </div>

                          {request.reason && (
                            <div className="flex items-start gap-2 text-sm">
                              <FileText className="h-3 w-3 mt-0.5 text-muted-foreground" />
                              <span className="text-muted-foreground">{request.reason}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}