"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Loader2
} from "lucide-react";
import { 
  ReplenishmentPreview, 
  getReplenishmentPreview, 
  replenishLeaveBalances 
} from "@/lib/actions/admin-leave-balance-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface LeaveBalanceReplenishmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessUnitId: string;
  currentYear: number;
}

export function LeaveBalanceReplenishmentDialog({ 
  open, 
  onOpenChange, 
  businessUnitId, 
  currentYear 
}: LeaveBalanceReplenishmentDialogProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<ReplenishmentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [replenishing, setReplenishing] = useState(false);
  const [showExcessWarning, setShowExcessWarning] = useState(false);
  const [excessWarnings, setExcessWarnings] = useState<string[]>([]);

  const targetYear = currentYear + 1;

  useEffect(() => {
    if (open) {
      loadPreview();
    }
  }, [open]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const previewData = await getReplenishmentPreview(businessUnitId, currentYear, targetYear);
      setPreview(previewData);
    } catch (error) {
      console.error("Error loading replenishment preview:", error);
      toast.error("Failed to load replenishment preview");
    } finally {
      setLoading(false);
    }
  };

  const handleReplenish = async (acknowledgeExcess: boolean = false) => {
    setReplenishing(true);
    try {
      const result = await replenishLeaveBalances(
        businessUnitId, 
        currentYear, 
        targetYear, 
        acknowledgeExcess
      );

      if (result.error && result.warnings) {
        // Show excess acknowledgment dialog
        setExcessWarnings(result.warnings);
        setShowExcessWarning(true);
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        onOpenChange(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to replenish leave balances");
    } finally {
      setReplenishing(false);
    }
  };

  const handleProceedWithExcess = async () => {
    setShowExcessWarning(false);
    await handleReplenish(true);
  };

  const usersWithExcess = preview?.carryOverInfo.filter(info => info.hasExcess) || [];
  const totalCarryOverUsers = preview?.carryOverInfo.length || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Replenish Leave Balances
            </DialogTitle>
            <DialogDescription>
              Create leave balances for {targetYear} with carry-over from {currentYear}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading replenishment preview...</span>
            </div>
          ) : preview ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="font-semibold">{preview.totalUsers}</div>
                    <div className="text-sm text-muted-foreground">Total Users</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <ArrowRight className="h-8 w-8 text-green-600" />
                  <div>
                    <div className="font-semibold">{totalCarryOverUsers}</div>
                    <div className="text-sm text-muted-foreground">With Carry-over</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                  <div>
                    <div className="font-semibold">{usersWithExcess.length}</div>
                    <div className="text-sm text-muted-foreground">With Excess</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Leave Types to Replenish */}
              <div>
                <h4 className="font-medium mb-3">Leave Types to Replenish</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {preview.leaveTypesToReplenish.map((leaveType) => (
                    <div key={leaveType.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-sm font-medium">{leaveType.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {leaveType.defaultAllocatedDays} days
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carry-over Information */}
              {totalCarryOverUsers > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">Carry-over Summary</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {preview.carryOverInfo.map((info, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                          <div className="flex-1">
                            <div className="font-medium">{info.userName}</div>
                            <div className="text-sm text-muted-foreground">
                              {info.employeeId} • {info.leaveTypeName}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {info.remainingDays} → {info.carryOverDays} days
                            </div>
                            {info.hasExcess && (
                              <div className="text-sm text-orange-600">
                                {info.excessDays} excess
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Excess Notice */}
              {usersWithExcess.length > 0 && (
                <>
                  <Separator />
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-amber-800 dark:text-amber-200">
                          Excess Leave Days Notice
                        </div>
                        <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          {usersWithExcess.length} users have more than 20 remaining days. 
                          All days will be carried over, but amounts above 20 days exceed the recommended guideline.
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Carry-over Rules */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-blue-800 dark:text-blue-200">
                      Carry-over Rules
                    </div>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                      <li>• Only VACATION and SICK LEAVE can carry over</li>
                      <li>• Recommended carry-over guideline: 20 days per leave type</li>
                      <li>• MANDATORY, BEREAVEMENT, UNPAID, PATERNITY, MATERNITY will reset to default allocation</li>
                      <li>• All days will be carried over (excess above 20 days will show with notice)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={replenishing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleReplenish(false)}
              disabled={loading || replenishing || !preview}
            >
              {replenishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Replenishing...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Replenish Balances
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excess Acknowledgment Alert Dialog */}
      <AlertDialog open={showExcessWarning} onOpenChange={setShowExcessWarning}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Acknowledge Excess Leave Days
            </AlertDialogTitle>
            <AlertDialogDescription>
              The following users have leave balances above the 20-day guideline. All days will be carried over, but these amounts exceed the recommended limit:
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="max-h-60 overflow-y-auto space-y-2">
            {excessWarnings.map((warning, index) => (
              <div key={index} className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm">
                {warning}
              </div>
            ))}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={replenishing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleProceedWithExcess}
              disabled={replenishing}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {replenishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Acknowledge & Proceed"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}