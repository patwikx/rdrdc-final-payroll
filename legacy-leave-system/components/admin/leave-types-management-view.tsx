"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  FileText,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { LeaveTypesResponse, deleteLeaveType } from "@/lib/actions/leave-type-actions";
import { CreateLeaveTypeDialog } from "@/components/admin/create-leave-type-dialog";
import { EditLeaveTypeDialog } from "@/components/admin/edit-leave-type-dialog";
import { toast } from "sonner";

interface LeaveTypesManagementViewProps {
  leaveTypesData: LeaveTypesResponse;
  businessUnitId: string;
  currentPage: number;
  searchTerm: string;
}

export function LeaveTypesManagementView({
  leaveTypesData,
  businessUnitId,
  currentPage,
  searchTerm: initialSearchTerm
}: LeaveTypesManagementViewProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<{
    id: string;
    name: string;
    defaultAllocatedDays: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { leaveTypes, pagination } = leaveTypesData;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    const params = new URLSearchParams();
    if (value) params.set('search', value);
    params.set('page', '1');
    router.push(`/${businessUnitId}/admin/leave-types?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    params.set('page', page.toString());
    router.push(`/${businessUnitId}/admin/leave-types?${params.toString()}`);
  };

  const handleEdit = (leaveType: typeof selectedLeaveType) => {
    setSelectedLeaveType(leaveType);
    setEditDialogOpen(true);
  };

  const handleDelete = (leaveType: typeof selectedLeaveType) => {
    setSelectedLeaveType(leaveType);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedLeaveType) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteLeaveType(businessUnitId, selectedLeaveType.id);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.refresh();
        setDeleteDialogOpen(false);
        setSelectedLeaveType(null);
      }
    } catch (error) {
      toast.error("Failed to delete leave type");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Leave Types Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage leave types and their default allocations
          </p>
        </div>
        
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Leave Type
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search leave types..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <Calendar className="h-8 w-8 text-blue-600" />
          <div>
            <div className="font-semibold">{pagination.totalCount}</div>
            <div className="text-sm text-muted-foreground">Total Leave Types</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <Users className="h-8 w-8 text-green-600" />
          <div>
            <div className="font-semibold">
              {leaveTypes.reduce((sum, lt) => sum + lt._count.leaveBalances, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Active Balances</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <FileText className="h-8 w-8 text-orange-600" />
          <div>
            <div className="font-semibold">
              {leaveTypes.reduce((sum, lt) => sum + lt._count.leaveRequests, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Requests</div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Default Days</TableHead>
              <TableHead>Active Balances</TableHead>
              <TableHead>Total Requests</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No leave types match your search criteria" : "No leave types found"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leaveTypes.map((leaveType) => (
                <TableRow key={leaveType.id}>
                  <TableCell>
                    <div className="font-medium">{leaveType.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {leaveType.defaultAllocatedDays} days
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{leaveType._count.leaveBalances}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{leaveType._count.leaveRequests}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(leaveType.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit({
                          id: leaveType.id,
                          name: leaveType.name,
                          defaultAllocatedDays: leaveType.defaultAllocatedDays
                        })}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete({
                          id: leaveType.id,
                          name: leaveType.name,
                          defaultAllocatedDays: leaveType.defaultAllocatedDays
                        })}
                        disabled={leaveType._count.leaveRequests > 0}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {leaveTypes.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm ? "No leave types match your search criteria" : "No leave types found"}
              </p>
            </div>
          </div>
        ) : (
          leaveTypes.map((leaveType) => (
            <div key={leaveType.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-lg">{leaveType.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Created {new Date(leaveType.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant="outline" className="font-mono">
                  {leaveType.defaultAllocatedDays} days
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground text-xs">Active Balances</div>
                    <div className="font-medium">{leaveType._count.leaveBalances}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground text-xs">Total Requests</div>
                    <div className="font-medium">{leaveType._count.leaveRequests}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleEdit({
                    id: leaveType.id,
                    name: leaveType.name,
                    defaultAllocatedDays: leaveType.defaultAllocatedDays
                  })}
                >
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDelete({
                    id: leaveType.id,
                    name: leaveType.name,
                    defaultAllocatedDays: leaveType.defaultAllocatedDays
                  })}
                  disabled={leaveType._count.leaveRequests > 0}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </Button>
              </div>

              {leaveType._count.leaveRequests > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Cannot delete - has active requests</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, pagination.totalCount)} of {pagination.totalCount} leave types
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrev}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <CreateLeaveTypeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        businessUnitId={businessUnitId}
      />

      {/* Edit Dialog */}
      {selectedLeaveType && (
        <EditLeaveTypeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          businessUnitId={businessUnitId}
          leaveType={selectedLeaveType}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Leave Type
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the leave type "{selectedLeaveType?.name}"? 
              This will also delete all associated leave balances. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}