"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Package, Calendar, User, FileText, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { MarkAsDoneDialog } from "./mark-as-done-dialog"
import { MaterialRequest } from "@/types/material-request-types"

interface PostedRequestDetailPageProps {
  request: MaterialRequest
  userRole: string
  businessUnitId: string
}

export function PostedRequestDetailPage({ request, userRole, businessUnitId }: PostedRequestDetailPageProps) {
  const router = useRouter()
  const [isDoneDialogOpen, setIsDoneDialogOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(false)

  const handleMarkAsDoneSuccess = () => {
    router.push(`/${businessUnitId}/mrs-coordinator/received`)
  }

  const canMarkAsDone = (userRole: string): boolean => {
    return ["ADMIN", "MANAGER", "PURCHASER", "STOCKROOM"].includes(userRole)
  }

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
            <h1 className="text-2xl font-semibold tracking-tight">Posted Request Details</h1>
            <p className="text-sm text-muted-foreground">
              Document No: {request.docNo}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Package className="h-3 w-3 mr-1" />
            Posted
          </Badge>
          {canMarkAsDone(userRole) && (
            <Button
              onClick={() => setIsDoneDialogOpen(true)}
              disabled={isLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark as Done
            </Button>
          )}
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
                {request.requestedBy.name} 
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

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Request Items ({request.items.length})</CardTitle>
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

      {/* Mark as Done Dialog */}
      <MarkAsDoneDialog
        request={request}
        isOpen={isDoneDialogOpen}
        onOpenChange={setIsDoneDialogOpen}
        onSuccess={handleMarkAsDoneSuccess}
      />
    </div>
  )
}