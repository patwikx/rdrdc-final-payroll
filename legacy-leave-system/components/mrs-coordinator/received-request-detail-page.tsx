/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useRouter } from "next/navigation"
import { Calendar, User, Building, FileText, DollarSign, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"

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

interface ReceivedRequestDetailPageProps {
  request: MaterialRequest
  userRole: string
  businessUnitId: string
}

export function ReceivedRequestDetailPage({ request, userRole, businessUnitId }: ReceivedRequestDetailPageProps) {

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A"
    return format(new Date(date), "MMM dd, yyyy 'at' h:mm a")
  }

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Done Request Details
            </h1>
            <p className="text-sm text-muted-foreground">
              Document No: {request.docNo} • Status: <span className="text-green-600 font-medium">DONE</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-sm px-3 py-1">
            <CheckCircle className="h-4 w-4 mr-2" />
            DONE
          </Badge>
        </div>
      </div>

      {/* Request Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Request Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Document No.</label>
                <p className="font-medium">{request.docNo}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type</label>
                <p className="font-medium">{request.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Series</label>
                <p className="font-medium">{request.series}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Confirmation No.</label>
                <p className="font-medium">{request.confirmationNo || "N/A"}</p>
              </div>
            </div>
            {request.purpose && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Purpose</label>
                <p className="font-medium">{request.purpose}</p>
              </div>
            )}
            {request.remarks && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Remarks</label>
                <p className="font-medium">{request.remarks}</p>
              </div>
            )}
            {request.deliverTo && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Deliver To</label>
                <p className="font-medium">{request.deliverTo}</p>
              </div>
            )}
            {request.purchaseOrderNumber && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Purchase Order No.</label>
                <p className="font-medium">{request.purchaseOrderNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requester Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Requester Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Requested By</label>
              <p className="font-medium">
                {request.requestedBy.firstName} {request.requestedBy.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{request.requestedBy.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Department</label>
              <p className="font-medium">{request.department?.name || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Business Unit</label>
              <p className="font-medium">{request.businessUnit.name}</p>
            </div>
            {request.chargeTo && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Charge To</label>
                <p className="font-medium">{request.chargeTo}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Important Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date Prepared</label>
              <p className="font-medium">{formatDate(request.datePrepared)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date Required</label>
              <p className="font-medium">{formatDate(request.dateRequired)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date Posted</label>
              <p className="font-medium">{formatDate(request.datePosted)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date Done</label>
              <p className="text-green-600 font-semibold">{formatDate(request.dateReceived)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{formatCurrency(request.total - request.freight + request.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Freight:</span>
              <span className="font-medium">{formatCurrency(request.freight)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount:</span>
              <span className="font-medium">-{formatCurrency(request.discount)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between">
                <span className="font-semibold">Total Amount:</span>
                <span className="font-bold text-lg">{formatCurrency(request.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Information */}
      {(request.supplierBPCode || request.supplierName) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Supplier Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {request.supplierBPCode && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">BP Code</label>
                <p className="font-medium">{request.supplierBPCode}</p>
              </div>
            )}
            {request.supplierName && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Supplier Name</label>
                <p className="font-medium">{request.supplierName}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approval Information */}
      {(request.recApprover || request.finalApprover) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Approval Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {request.recApprover && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Recommending Approver</label>
                <p className="font-medium">
                  {request.recApprover.firstName} {request.recApprover.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{request.recApprover.email}</p>
              </div>
            )}
            {request.finalApprover && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Final Approver</label>
                <p className="font-medium">
                  {request.finalApprover.firstName} {request.finalApprover.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{request.finalApprover.email}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Done Items ({request.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total Price</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemCode || "N/A"}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {item.unitPrice ? formatCurrency(item.unitPrice) : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.totalPrice ? formatCurrency(item.totalPrice) : "N/A"}
                    </TableCell>
                    <TableCell>{item.remarks || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}