"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Package, Eye, CheckCircle, MoreVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { MarkAsPostedDialog } from "./mark-as-posted-dialog"
import { MaterialRequest } from "@/types/material-request-types"

interface ForPostingRequestsClientProps {
  initialRequests: MaterialRequest[]
  userRole: string
  isAcctg: boolean
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

export function ForPostingRequestsClient({ initialRequests, userRole, isAcctg, businessUnitId }: ForPostingRequestsClientProps) {
  const [requests, setRequests] = useState<MaterialRequest[]>(initialRequests)
  const [searchTerm, setSearchTerm] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null)
  const [isMarkAsPostedDialogOpen, setIsMarkAsPostedDialogOpen] = useState(false)
  const router = useRouter()

  const filteredRequests = useMemo(() => {
    if (!searchTerm) return requests
    
    return requests.filter(request => 
      request.docNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.confirmationNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requestedBy.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [requests, searchTerm])

  const handleMarkAsPosted = (request: MaterialRequest) => {
    setSelectedRequest(request)
    setIsMarkAsPostedDialogOpen(true)
  }

  const handleMarkAsPostedSuccess = () => {
    if (selectedRequest) {
      // Remove the request from the list since it's now posted
      setRequests(prev => prev.filter(req => req.id !== selectedRequest.id))
      router.refresh()
    }
    setSelectedRequest(null)
  }

  const canMarkAsPosted = (userRole: string, hasAcctgPermission: boolean): boolean => {
    return userRole === "ADMIN" || hasAcctgPermission
  }


  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">For Posting Requests</h1>
          <p className="text-sm text-muted-foreground">
            Material requests ready to be posted and marked as done
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by document number, purpose, confirmation number, or requester..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredRequests.length} of {requests.length} requests for posting
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
              <TableHead>Date Posted</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No requests for posting found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-medium">{request.docNo}</span>
                    </div></TableCell>
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
                    {request.datePosted ? format(new Date(request.datePosted), "MMM dd, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell>₱{request.total.toLocaleString()}</TableCell>
                  <TableCell>{request.items.length} items</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canMarkAsPosted(userRole, isAcctg) && (
                            <>
                              <DropdownMenuItem onClick={() => handleMarkAsPosted(request)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Posted
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
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
              ))
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
              <p className="text-muted-foreground">No requests for posting found</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <CardTitle className="text-base">{request.docNo}</CardTitle>
                  </div>
                  <Badge variant="outline">{request.type}</Badge>
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
                    <span className="text-muted-foreground">Date Posted:</span>
                    <p className="font-medium">
                      {request.datePosted ? format(new Date(request.datePosted), "MMM dd, yyyy") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Confirmation No:</span>
                    <p className="font-medium">{request.confirmationNo || "N/A"}</p>
                  </div>
                </div>

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
                  {canMarkAsPosted(userRole, isAcctg) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleMarkAsPosted(request)}
                      disabled={isLoading}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Posted
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/${businessUnitId}/material-requests/${request.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Mark as Posted Dialog */}
      {selectedRequest && (
        <MarkAsPostedDialog
          request={selectedRequest}
          isOpen={isMarkAsPostedDialogOpen}
          onOpenChange={setIsMarkAsPostedDialogOpen}
          onSuccess={handleMarkAsPostedSuccess}
        />
      )}
    </div>
  )
}