"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Package, Eye, CheckCircle2, MoreVertical, FileCheck, Link2, FileSignature } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { MaterialRequest } from "@/types/material-request-types"

interface DoneRequestsClientProps {
  initialRequests: MaterialRequest[]
  userRole: string
  businessUnitId: string
}

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function DoneRequestsClient({ 
  initialRequests, 
  businessUnitId 
}: DoneRequestsClientProps) {
  const [requests] = useState<MaterialRequest[]>(initialRequests)
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()

  const filteredRequests = useMemo(() => {
    if (!searchTerm) return requests
    
    return requests.filter(request => 
      request.docNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.confirmationNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requestedBy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.purchaseOrderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [requests, searchTerm])

  const handleCreateAcknowledgement = (requestId: string) => {
    router.push(`/${businessUnitId}/material-requests/${requestId}/acknowledgement`)
  }

  const handleCopyPublicUrl = (requestId: string) => {
    const publicUrl = `${window.location.origin}/public/acknowledgement/${requestId}`
    navigator.clipboard.writeText(publicUrl)
    toast.success("Public acknowledgement URL copied to clipboard!")
  }

  const handleViewSignedAcknowledgement = (requestId: string) => {
    router.push(`/public/acknowledgement/${requestId}`)
  }

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Done/Posted Requests</h1>
          <p className="text-sm text-muted-foreground">
            Material requests that have been posted and are ready for acknowledgement
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by document number, purpose, confirmation number, requester, supplier, or PO number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-l-yellow-400 dark:border-l-yellow-600 rounded-sm" />
          <span className="text-muted-foreground">Needs Acknowledgement</span>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRequests.length} of {requests.length} posted requests
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Date Received</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Items</TableHead>
               <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No posted requests found</p>
                    <p className="text-xs text-muted-foreground">
                      Requests appear here when they have been marked as posted
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                const needsAcknowledgement = !request.acknowledgedAt;
                
                return (
                <TableRow 
                  key={request.id}
                  className={needsAcknowledgement ? "bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 border-l-4 border-l-yellow-400 dark:border-l-yellow-600" : ""}
                >
                  <TableCell className="font-medium">{request.docNo}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{request.type}</Badge>
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
                  <TableCell>{request.department?.name || "N/A"}</TableCell>
                  <TableCell>
                    {request.dateReceived ? format(new Date(request.dateReceived), "MMM dd, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell>{request.supplierName || "N/A"}</TableCell>
                  <TableCell>{request.purchaseOrderNumber || "N/A"}</TableCell>
                  <TableCell>₱{request.total.toLocaleString()}</TableCell>
                  <TableCell>{request.items.length} items</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(request as MaterialRequest & { signatureData?: string | null }).signatureData ? (
                            <>
                              <DropdownMenuItem onClick={() => handleViewSignedAcknowledgement(request.id)}>
                                <FileSignature className="h-4 w-4 mr-2" />
                                View Signed Acknowledgement
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyPublicUrl(request.id)}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Copy Public URL
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => handleCreateAcknowledgement(request.id)}>
                              <FileCheck className="h-4 w-4 mr-2" />
                              Create Acknowledgement
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => router.push(`/${businessUnitId}/material-requests/${request.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No posted requests found</p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Requests appear here when they have been marked as posted
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            const needsAcknowledgement = !request.acknowledgedAt;
            
            return (
            <Card 
              key={request.id}
              className={needsAcknowledgement ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 border-l-4 border-l-yellow-400 dark:border-l-yellow-600" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <CardTitle className="text-base">{request.docNo}</CardTitle>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline">{request.type}</Badge>
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10 rounded-md">
                    <AvatarImage 
                      src={request.requestedBy.profilePicture ? `/api/profile-picture/${encodeURIComponent(request.requestedBy.profilePicture)}?direct=true` : undefined}
                      alt={request.requestedBy.name}
                    />
                    <AvatarFallback>{getUserInitials(request.requestedBy.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-muted-foreground">Requested By</p>
                    <p className="font-medium">{request.requestedBy.name}</p>
                    <p className="text-xs text-muted-foreground">{request.requestedBy.employeeId}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <p className="font-medium">{request.department?.name || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date Received:</span>
                    <p className="font-medium">
                      {request.dateReceived ? format(new Date(request.dateReceived), "MMM dd, yyyy") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supplier:</span>
                    <p className="font-medium">{request.supplierName || "N/A"}</p>
                  </div>
                </div>

                {request.purchaseOrderNumber && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">PO Number:</span>
                    <p className="font-medium">{request.purchaseOrderNumber}</p>
                  </div>
                )}

                <div className="bg-muted/30 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Amount</span>
                    <span className="text-lg font-semibold">₱{request.total.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {request.items.length} items
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {(request as MaterialRequest & { signatureData?: string | null }).signatureData ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewSignedAcknowledgement(request.id)}
                    >
                      <FileSignature className="h-4 w-4 mr-2" />
                      View Signed
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCreateAcknowledgement(request.id)}
                    >
                      <FileCheck className="h-4 w-4 mr-2" />
                      Create Acknowledgement
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(request as MaterialRequest & { signatureData?: string | null }).signatureData && (
                        <DropdownMenuItem onClick={() => handleCopyPublicUrl(request.id)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          Copy Public URL
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => router.push(`/${businessUnitId}/material-requests/${request.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          )
          })
        )}
      </div>
    </div>
  )
}