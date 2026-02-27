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
  Package,
  FileText,
  Eye,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { BudgetApprovalActions } from "@/components/approvals/budget-approval-actions";

interface MaterialRequestItem {
  id: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number | null;
  totalPrice: number | null;
}

interface PendingBudgetRequest {
  id: string;
  docNo: string;
  series: string;
  type: string;
  purpose: string | null;
  dateRequired: Date;
  total: number;
  createdAt: Date;
  requestedBy: {
    id: string;
    name: string;
    employeeId: string;
    profilePicture: string | null;
  };
  items: MaterialRequestItem[];
  budgetApprovalStatus: string | null;
  isWithinBudget: boolean | null;
  budgetRemarks: string | null;
}

interface PendingBudgetApprovalsViewProps {
  requests: PendingBudgetRequest[];
  businessUnitId: string;
}

function getRequestTypeIcon(type: string) {
  return type === "ITEM" ? Package : FileText;
}

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PendingBudgetApprovalsView({ 
  requests, 
  businessUnitId
}: PendingBudgetApprovalsViewProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.docNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.series.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (request.purpose && request.purpose.toLowerCase().includes(searchTerm.toLowerCase())) ||
        request.requestedBy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requestedBy.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.items.some(item => 
          item.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    return filtered;
  }, [requests, searchTerm]);

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pending Budget Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve budget for material requests from RDH/MRS users
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search by document no, employee, purpose, or item description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRequests.length} of {requests.length} pending budget approvals
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Type</TableHead>
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
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No pending budget approvals found</p>
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
                      <BudgetApprovalActions 
                        request={request} 
                        businessUnitId={businessUnitId}
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
              <DollarSign className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No pending budget approvals found</p>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/${businessUnitId}/material-requests/${request.id}`)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
                      {request.items.slice(0, 3).map((item) => (
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
                    <BudgetApprovalActions 
                      request={request} 
                      businessUnitId={businessUnitId}
                      isMobile={true}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
