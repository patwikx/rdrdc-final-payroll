"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Calendar, 
  Users,
  Plus,
  Save,
  X,
  Check,
  Edit,
  FolderOpen,
  User,
  RefreshCw
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminLeaveBalancesResponse, UserLeaveBalance, updateLeaveBalance, bulkUpdateLeaveBalances } from "@/lib/actions/admin-leave-balance-actions";
import { LeaveBalanceReplenishmentDialog } from "./leave-balance-replenishment-dialog";
import { toast } from "sonner";

interface LeaveBalancesManagementViewProps {
  balancesData: AdminLeaveBalancesResponse;
  businessUnitId: string;
  currentFilters: {
    year?: number;
    leaveTypeId?: string;
    userId?: string;
    page: number;
  };
}

interface EditingBalance {
  id: string;
  allocatedDays: number;
}

export function LeaveBalancesManagementView({ 
  balancesData, 
  businessUnitId,
  currentFilters 
}: LeaveBalancesManagementViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBalances, setSelectedBalances] = useState<Set<string>>(new Set());
  const [editingBalances, setEditingBalances] = useState<Map<string, EditingBalance>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [showReplenishmentDialog, setShowReplenishmentDialog] = useState(false);

  const filteredBalances = useMemo(() => {
    let filtered = balancesData.balances;

    // Apply search term filter
    if (searchTerm) {
      filtered = filtered.filter(balance => 
        balance.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        balance.user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        balance.leaveType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (balance.user.department?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [balancesData.balances, searchTerm]);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to first page when filters change
    params.delete('page');
    
    router.push(`/${businessUnitId}/admin/leave-balances?${params.toString()}`);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBalances(new Set(filteredBalances.map(b => b.id)));
    } else {
      setSelectedBalances(new Set());
    }
  };

  const handleSelectBalance = (balanceId: string, checked: boolean) => {
    const newSelected = new Set(selectedBalances);
    if (checked) {
      newSelected.add(balanceId);
    } else {
      newSelected.delete(balanceId);
    }
    setSelectedBalances(newSelected);
  };

  const startEditing = (balance: UserLeaveBalance) => {
    const newEditing = new Map(editingBalances);
    newEditing.set(balance.id, {
      id: balance.id,
      allocatedDays: balance.allocatedDays
    });
    setEditingBalances(newEditing);
  };

  const cancelEditing = (balanceId: string) => {
    const newEditing = new Map(editingBalances);
    newEditing.delete(balanceId);
    setEditingBalances(newEditing);
  };

  const updateEditingValue = (balanceId: string, allocatedDays: number) => {
    const newEditing = new Map(editingBalances);
    const existing = newEditing.get(balanceId);
    if (existing) {
      newEditing.set(balanceId, { ...existing, allocatedDays });
      setEditingBalances(newEditing);
    }
  };

  const saveBalance = async (balanceId: string) => {
    const editingBalance = editingBalances.get(balanceId);
    if (!editingBalance) return;

    setIsSaving(true);
    try {
      const result = await updateLeaveBalance(
        balanceId,
        businessUnitId,
        editingBalance.allocatedDays
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        cancelEditing(balanceId);
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to update leave balance");
    } finally {
      setIsSaving(false);
    }
  };

  const saveBulkChanges = async () => {
    if (editingBalances.size === 0) return;

    setIsSaving(true);
    try {
      const updates = Array.from(editingBalances.values()).map(editing => ({
        balanceId: editing.id,
        allocatedDays: editing.allocatedDays
      }));

      const result = await bulkUpdateLeaveBalances(updates, businessUnitId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setEditingBalances(new Map());
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to update leave balances");
    } finally {
      setIsSaving(false);
    }
  };

  const cancelAllEditing = () => {
    setEditingBalances(new Map());
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Leave Balances Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage employee leave balances and allocations
          </p>
        </div>
        
        <div className="flex gap-2">
          {editingBalances.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={cancelAllEditing}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Changes
              </Button>
              <Button
                onClick={saveBulkChanges}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : `Save Changes (${editingBalances.size})`}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => setShowReplenishmentDialog(true)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Replenish Balances
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Balance
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by employee name, ID, leave type, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Year Filter */}
        <Select
          value={currentFilters.year?.toString() || currentYear.toString()}
          onValueChange={(value) => updateFilter('year', value)}
        >
          <SelectTrigger className="w-[120px]">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Leave Type Filter */}
        <Select
          value={currentFilters.leaveTypeId || ""}
          onValueChange={(value) => updateFilter('leaveTypeId', value || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All leave types" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span>All leave types</span>
              </div>
            </SelectItem>
            {balancesData.leaveTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* User Filter */}
        <Select
          value={currentFilters.userId || ""}
          onValueChange={(value) => updateFilter('userId', value || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All employees" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>All employees</span>
              </div>
            </SelectItem>
            {balancesData.users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} ({user.employeeId})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count and selection info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredBalances.length} of {balancesData.balances.length} leave balances
        </span>
        {selectedBalances.size > 0 && (
          <span>
            {selectedBalances.size} selected
          </span>
        )}
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedBalances.size === filteredBalances.length && filteredBalances.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Allocated Days</TableHead>
              <TableHead>Used Days</TableHead>
              <TableHead>Remaining Days</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBalances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No leave balances match your search criteria" : "No leave balances found"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredBalances.map((balance) => {
                const isEditing = editingBalances.has(balance.id);
                const editingValue = editingBalances.get(balance.id);
                
                return (
                  <TableRow key={balance.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedBalances.has(balance.id)}
                        onCheckedChange={(checked: boolean) => handleSelectBalance(balance.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{balance.user.name}</div>
                        <div className="text-sm text-muted-foreground">{balance.user.employeeId}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {balance.user.department?.name || 'No Department'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {balance.leaveType.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{balance.year}</span>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editingValue?.allocatedDays || 0}
                          onChange={(e) => updateEditingValue(balance.id, parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      ) : (
                        <span className="font-medium">{balance.allocatedDays}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{balance.usedDays}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${balance.remainingDays < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {isEditing && editingValue ? 
                            (editingValue.allocatedDays - balance.usedDays).toFixed(1) : 
                            balance.remainingDays.toFixed(1)
                          }
                        </span>
                        {balance.remainingDays > 20 && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            Excess
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveBalance(balance.id)}
                              disabled={isSaving}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelEditing(balance.id)}
                              disabled={isSaving}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(balance)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-4 sm:hidden">
        {filteredBalances.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No leave balances found</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm ? "No balances match your search criteria." : "No leave balances have been set up yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredBalances.map((balance) => {
            const isEditing = editingBalances.has(balance.id);
            const editingValue = editingBalances.get(balance.id);
            
            return (
              <Card key={balance.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedBalances.has(balance.id)}
                        onCheckedChange={(checked: boolean) => handleSelectBalance(balance.id, checked)}
                      />
                      <div>
                        <div className="font-medium">{balance.user.name}</div>
                        <div className="text-sm text-muted-foreground">{balance.user.employeeId}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {balance.leaveType.name}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Department:</span>
                      <p className="font-medium">{balance.user.department?.name || 'No Department'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Year:</span>
                      <p className="font-medium">{balance.year}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Allocated:</span>
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={editingValue?.allocatedDays || 0}
                          onChange={(e) => updateEditingValue(balance.id, parseFloat(e.target.value) || 0)}
                          className="mt-1"
                        />
                      ) : (
                        <p className="font-medium">{balance.allocatedDays} days</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Used:</span>
                      <p className="font-medium">{balance.usedDays} days</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Remaining:</span>
                      <p className={`font-medium ${balance.remainingDays < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {isEditing && editingValue ? 
                          (editingValue.allocatedDays - balance.usedDays).toFixed(1) : 
                          balance.remainingDays.toFixed(1)
                        } days
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => saveBalance(balance.id)}
                          disabled={isSaving}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => cancelEditing(balance.id)}
                          disabled={isSaving}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => startEditing(balance)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Replenishment Dialog */}
      <LeaveBalanceReplenishmentDialog
        open={showReplenishmentDialog}
        onOpenChange={setShowReplenishmentDialog}
        businessUnitId={businessUnitId}
        currentYear={currentFilters.year || new Date().getFullYear()}
      />
    </div>
  );
}