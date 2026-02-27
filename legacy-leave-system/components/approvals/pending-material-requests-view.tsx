"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Calendar, 
  Package,
  DollarSign,
  Clock,
  Building2,
  Filter,
  FolderOpen,
  FileText,
  Eye
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  PendingMaterialRequestsResponse, 
  PendingMaterialRequest 
} from "@/lib/actions/mrs-actions/material-request-approval-actions";
import { MaterialRequestApprovalActions } from "@/components/approvals/material-request-approval-actions";
import { MRSRequestStatus } from "@prisma/client";

interface PendingMaterialRequestsViewProps {
  requestsData: PendingMaterialRequestsResponse;
  businessUnitId: string;
  currentFilters: {
    status?: string;
    type?: string;
    page: number;
  };
  currentUserRole: string;
  isSpecialApprover?: boolean;
}

function getRequestTypeIcon(type: string) {
  return type === "ITEM" ? Package : FileText;
}

function formatRequestStatus(status: MRSRequestStatus): string {
  switch (status) {
    case 'FOR_REC_APPROVAL':
      return 'Pending Rec. Approval';
    case 'FOR_FINAL_APPROVAL':
      return 'Pending Final Approval';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
  }
}

function getStatusVariant(status: MRSRequestStatus) {
  switch (status) {
    case 'FOR_REC_APPROVAL':
      return 'default'; // Blue color for recommending approval
    case 'FOR_FINAL_APPROVAL':
      return 'secondary'; // Gray color for final approval
    default:
      return 'outline';
  }
}

const statusOptions = [
  { value: 'FOR_REC_APPROVAL', label: 'Pending Rec. Approval', icon: Clock },
  { value: 'FOR_FINAL_APPROVAL', label: 'Pending Final Approval', icon: Clock }
];

const typeOptions = [
  { value: 'ITEM', label: 'Item Request', icon: Package },
  { value: 'SERVICE', label: 'Service Request', icon: FileText }
];

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PendingMaterialRequestsView({ 
  requestsData, 
  businessUnitId,
  currentFilters,
  currentUserRole,
  isSpecialApprover = false
}: PendingMaterialRequestsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requests = requestsData.materialRequests;
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Apply search term filter
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.docNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.series.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (request.purpose && request.purpose.toLowerCase().includes(searchTerm.toLowerCase())) ||
        request.requestedBy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requestedBy.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatRequestStatus(request.status).toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.items.some(item => 
          item.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    return filtered;
  }, [requests, searchTerm]);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value && value !== `all-${key}`) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    // Reset to first page when filters change
    params.delete('page');
    
    router.push(`/${businessUnitId}/approvals/material-requests/pending?${params.toString()}`);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/${businessUnitId}/approvals/material-requests/pending?${params.toString()}`);
  };

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pending Material Request Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve material requests assigned to you
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by document no, employee, purpose, or item description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Filters Row */}
        <div className="flex gap-2">
          {/* Status Filter */}
          <Select
            value={currentFilters.status || ""}
            onValueChange={(value) => updateFilter('status', value || undefined)}
          >
            <SelectTrigger className="flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <SelectValue placeholder="All statuses" className="truncate" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span>All statuses</span>
                </div>
              </SelectItem>
              {statusOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select
            value={currentFilters.type || ""}
            onValueChange={(value) => updateFilter('type', value || undefined)}
          >
            <SelectTrigger className="flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <SelectValue placeholder="All types" className="truncate" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-type">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span>All types</span>
                </div>
              </SelectItem>
              {typeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRequests.length} of {requests.length} pending requests
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              {isSpecialApprover && <TableHead>Business Unit</TableHead>}
              <TableHead>Requested By</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Required</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSpecialApprover ? 10 : 9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No pending material requests found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                const Icon = getRequestTypeIcon(request.type);
                
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.docNo}</div>
                        <div className="text-sm text-muted-foreground">{request.series}</div>
                      </div>
                    </TableCell>
                    {isSpecialApprover && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{request.businessUnit.name}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-md">
                          <AvatarImage 
                            src={request.requestedBy.profilePicture ? `/api/profile-picture/${encodeURIComponent(request.requestedBy.profilePicture)}?direct=true` : undefined}
                            alt={request.requestedBy.name}
                          />
                          <AvatarFallback>{getUserInitials(request.requestedBy.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{request.requestedBy.name}</div>
                          <div className="text-sm text-muted-foreground">{request.requestedBy.employeeId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.type} REQUEST</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(request.status)}>
                        {formatRequestStatus(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(request.dateRequired, 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {request.items.length} {request.items.length === 1 ? 'item' : 'items'}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ₱{request.total.toLocaleString()}
                    </TableCell>
                    <TableCell>{format(request.createdAt, "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <MaterialRequestApprovalActions 
                        request={request} 
                        businessUnitId={businessUnitId}
                        currentUserRole={currentUserRole}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No pending material requests found</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            const Icon = getRequestTypeIcon(request.type);
            
            return (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{request.docNo}</CardTitle>
                      <p className="text-sm text-muted-foreground">{request.series}</p>
                    </div>
                    <div className="flex items-center gap-2">

                      <Badge variant={getStatusVariant(request.status)}>
                        {formatRequestStatus(request.status)}
                      </Badge>
                                            <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/${businessUnitId}/material-requests/${request.id}`)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-md">
                      <AvatarImage 
                        src={request.requestedBy.profilePicture ? `/api/profile-picture/${encodeURIComponent(request.requestedBy.profilePicture)}?direct=true` : undefined}
                        alt={request.requestedBy.name}
                      />
                      <AvatarFallback>{getUserInitials(request.requestedBy.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium">{request.requestedBy.name}</span>
                      <div className="text-sm text-muted-foreground">{request.requestedBy.employeeId}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{request.type} REQUEST</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Date Required:</span>
                      <p className="font-medium">{format(request.dateRequired, 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Items:</span>
                      <p className="font-medium">{request.items.length} {request.items.length === 1 ? 'item' : 'items'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Amount:</span>
                      <p className="font-medium">₱{request.total.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <p className="font-medium">{format(request.createdAt, "MMM dd, yyyy")}</p>
                    </div>
                  </div>

                  {request.purpose && (
                    <div>
                      <span className="text-muted-foreground text-sm">Purpose:</span>
                      <p className="text-sm mt-1">{request.purpose}</p>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Items ({request.items.length})</span>
                    </div>
                    <div className="space-y-2">
                      {request.items.slice(0, 3).map((item, index) => (
                        <div key={item.id} className="flex justify-between items-start text-xs bg-muted/30 p-2 rounded">
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{item.description}</p>
                            <p className="text-muted-foreground">{item.quantity} {item.uom}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">₱{((item.unitPrice || 0) * item.quantity).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                      {request.items.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center py-1">
                          +{request.items.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <MaterialRequestApprovalActions 
                      request={request} 
                      businessUnitId={businessUnitId}
                      currentUserRole={currentUserRole}
                      isMobile={true}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {requestsData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((requestsData.pagination.currentPage - 1) * 10) + 1} to{' '}
            {Math.min(requestsData.pagination.currentPage * 10, requestsData.pagination.totalCount)} of{' '}
            {requestsData.pagination.totalCount} requests
          </div>
          
          <div className="flex gap-2">
            {requestsData.pagination.hasPrev && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(requestsData.pagination.currentPage - 1)}
              >
                Previous
              </Button>
            )}
            
            {requestsData.pagination.hasNext && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(requestsData.pagination.currentPage + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}