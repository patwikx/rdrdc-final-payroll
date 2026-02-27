"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Package, Eye, CheckCircle, FileText } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface MaterialRequestItem {
  id: string
  itemCode: string | null
  description: string
  uom: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  remarks: string | null
}

interface MaterialRequest {
  id: string
  docNo: string
  series: string
  type: string
  status: string
  datePrepared: Date
  dateRequired: Date
  datePosted: Date | null
  dateReceived: Date | null
  businessUnit: {
    id: string
    name: string
    code: string
  }
  department: {
    id: string
    name: string
    code: string
  } | null
  chargeTo: string | null
  purpose: string | null
  remarks: string | null
  deliverTo: string | null
  freight: number
  discount: number
  total: number
  confirmationNo: string | null
  supplierBPCode: string | null
  supplierName: string | null
  purchaseOrderNumber: string | null
  requestedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  recApprover: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  finalApprover: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  items: MaterialRequestItem[]
}

interface ReceivedRequestsClientProps {
  initialRequests: MaterialRequest[]
  userRole: string
  businessUnitId: string
}

export function ReceivedRequestsClient({ 
  initialRequests, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userRole, 
  businessUnitId 
}: ReceivedRequestsClientProps) {
  const [requests] = useState<MaterialRequest[]>(initialRequests)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredRequests = useMemo(() => {
    if (!searchTerm) return requests

    return requests.filter(request => 
      request.docNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.confirmationNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${request.requestedBy.firstName} ${request.requestedBy.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [requests, searchTerm])

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Done Requests</h1>
          <p className="text-sm text-muted-foreground">
            View all material requests that have been completed and fulfilled
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
        Showing {filteredRequests.length} of {requests.length} done requests
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document No.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Date Done</TableHead>
              <TableHead>Confirmation No.</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No done requests found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.docNo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      DONE
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {request.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {request.requestedBy.firstName} {request.requestedBy.lastName}
                  </TableCell>
                  <TableCell>{request.department?.name || "N/A"}</TableCell>
                  <TableCell>
                    {request.dateReceived ? format(new Date(request.dateReceived), "MMM dd, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell>{request.confirmationNo || "N/A"}</TableCell>
                  <TableCell>
                    {request.supplierBPCode ? (
                      <div className="text-sm">
                        <div className="font-medium">{request.supplierBPCode}</div>
                        <div className="text-muted-foreground text-xs">{request.supplierName}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {request.purchaseOrderNumber ? (
                      <span className="font-medium">{request.purchaseOrderNumber}</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>₱{request.total.toLocaleString()}</TableCell>
                  <TableCell>{request.items.length} items</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/${businessUnitId}/mrs-coordinator/received/${request.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/${businessUnitId}/material-requests/${request.id}/acknowledgement`}>
                          <FileText className="h-4 w-4" />
                        </Link>
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
      <div className="sm:hidden space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No done requests found</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <CardTitle className="text-base">{request.docNo}</CardTitle>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      DONE
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {request.type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Requested by:</span>
                    <p className="font-medium">
                      {request.requestedBy.firstName} {request.requestedBy.lastName}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <p className="font-medium">{request.department?.name || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date Done:</span>
                    <p className="font-medium">
                      {request.dateReceived ? format(new Date(request.dateReceived), "MMM dd, yyyy") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Confirmation No:</span>
                    <p className="font-medium">{request.confirmationNo || "N/A"}</p>
                  </div>
                </div>
                
                {(request.supplierBPCode || request.purchaseOrderNumber) && (
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {request.supplierBPCode && (
                      <div>
                        <span className="text-muted-foreground">Supplier:</span>
                        <p className="font-medium">{request.supplierBPCode}</p>
                        <p className="text-xs text-muted-foreground">{request.supplierName}</p>
                      </div>
                    )}
                    {request.purchaseOrderNumber && (
                      <div>
                        <span className="text-muted-foreground">PO Number:</span>
                        <p className="font-medium">{request.purchaseOrderNumber}</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-800">Total Amount</span>
                    <span className="text-lg font-semibold text-green-900">₱{request.total.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-green-600">{request.items.length} items completed</span>
                    <span className="text-xs text-green-600 font-medium">✓ COMPLETED</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/${businessUnitId}/mrs-coordinator/received/${request.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/${businessUnitId}/material-requests/${request.id}/acknowledgement`}>
                      <FileText className="h-4 w-4 mr-2" />
                      Acknowledgement
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}