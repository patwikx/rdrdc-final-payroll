"use client";

import { useState, useMemo, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Calendar, 
  Package,
  Clock,
  Eye,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  PendingReviewRequestsResponse,
  markAsReviewed
} from "@/lib/actions/mrs-actions/material-request-approval-actions";
import { toast } from "sonner";

interface PendingReviewViewProps {
  requestsData: PendingReviewRequestsResponse;
  businessUnitId: string;
}

export function PendingReviewView({ 
  requestsData, 
  businessUnitId
}: PendingReviewViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requests = requestsData.materialRequests;
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

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

  const handleMarkAsReviewed = async (requestId: string) => {
    setReviewingIds(prev => new Set(prev).add(requestId));
    
    startTransition(async () => {
      try {
        const result = await markAsReviewed(requestId, businessUnitId);
        
        if (result.success) {
          toast.success(result.success);
          router.refresh();
        } else {
          toast.error(result.error || "Failed to mark as reviewed");
        }
      } catch (error) {
        toast.error("An error occurred while marking as reviewed");
      } finally {
        setReviewingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(requestId);
          return newSet;
        });
      }
    });
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`/${businessUnitId}/approvals/review?${params.toString()}`);
  };

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pending Store Use Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Review store use material requests before they proceed to approval
          </p>
        </div>
      </div>

      {/* Search */}
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
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRequests.length} of {requests.length} pending reviews
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Review</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Requested By</TableHead>
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
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No pending store use reviews</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                const isReviewing = reviewingIds.has(request.id);
                
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {isReviewing ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => handleMarkAsReviewed(request.id)}
                            aria-label={`Mark ${request.docNo} as reviewed`}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.docNo}</div>
                        <div className="text-sm text-muted-foreground">{request.series}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.requestedBy.name}</div>
                        <div className="text-sm text-muted-foreground">{request.requestedBy.employeeId}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(request.dateRequired), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {request.items.length} {request.items.length === 1 ? 'item' : 'items'}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ₱{request.total.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(request.datePrepared), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/${businessUnitId}/material-requests/${request.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
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
              <CheckCircle2 className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No pending store use reviews</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            const isReviewing = reviewingIds.has(request.id);
            
            return (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{request.docNo}</CardTitle>
                      <p className="text-sm text-muted-foreground">{request.series}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending Review
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
                  <div>
                    <span className="text-muted-foreground text-sm">Requested By:</span>
                    <div className="font-medium">{request.requestedBy.name}</div>
                    <div className="text-sm text-muted-foreground">{request.requestedBy.employeeId}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Date Required:</span>
                      <p className="font-medium">{format(new Date(request.dateRequired), 'MMM dd, yyyy')}</p>
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
                      <p className="font-medium">{format(new Date(request.datePrepared), "MMM dd, yyyy")}</p>
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

                  {/* Mark as Reviewed Button */}
                  <div className="pt-2">
                    <Button
                      className="w-full"
                      onClick={() => handleMarkAsReviewed(request.id)}
                      disabled={isReviewing}
                    >
                      {isReviewing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Marking as Reviewed...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark as Reviewed
                        </>
                      )}
                    </Button>
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
