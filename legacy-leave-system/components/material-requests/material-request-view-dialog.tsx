"use client"

import { format } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { MaterialRequest, REQUEST_STATUS_LABELS, REQUEST_STATUS_COLORS, REQUEST_TYPE_LABELS, APPROVAL_STATUS_LABELS } from "@/types/material-request-types"

interface MaterialRequestViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: MaterialRequest
}

export function MaterialRequestViewDialog({
  open,
  onOpenChange,
  request,
}: MaterialRequestViewDialogProps) {
  const itemsTotal = request.items.reduce((sum, item) => {
    return sum + (Number(item.totalPrice) || 0)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Material Request Details
            <Badge className={REQUEST_STATUS_COLORS[request.status]}>
              {REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Document No: {request.docNo} • Type: {REQUEST_TYPE_LABELS[request.type]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Document Number</h4>
                  <p className="font-medium">{request.docNo}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Request Type</h4>
                  <p>{REQUEST_TYPE_LABELS[request.type]}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                  <Badge className={REQUEST_STATUS_COLORS[request.status]}>
                    {REQUEST_STATUS_LABELS[request.status]}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Requested By</h4>
                  <p>{request.requestedBy.name}</p>
                  <p className="text-sm text-muted-foreground">{request.requestedBy.email}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Business Unit</h4>
                  <p>{request.businessUnit.name}</p>
                  <p className="text-sm text-muted-foreground">({request.businessUnit.code})</p>
                </div>
                {request.department && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground">Department</h4>
                    <p>{request.department.name}</p>
                    <p className="text-sm text-muted-foreground">({request.department.code})</p>
                  </div>
                )}
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Date Prepared</h4>
                  <p>{format(new Date(request.datePrepared), "PPP")}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Date Required</h4>
                  <p>{format(new Date(request.dateRequired), "PPP")}</p>
                </div>
              </div>

              {(request.chargeTo || request.deliverTo) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {request.chargeTo && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Charge To</h4>
                        <p>{request.chargeTo}</p>
                      </div>
                    )}
                    {request.deliverTo && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Deliver To</h4>
                        <p className="whitespace-pre-wrap">{request.deliverTo}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(request.purpose || request.remarks) && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    {request.purpose && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Purpose</h4>
                        <p className="whitespace-pre-wrap">{request.purpose}</p>
                      </div>
                    )}
                    {request.remarks && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Remarks</h4>
                        <p className="whitespace-pre-wrap">{request.remarks}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Approval Information */}
          {(request.recApprover || request.finalApprover) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Approval Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.recApprover && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Recommending Approver</h4>
                      <p>{request.recApprover.name}</p>
                      <p className="text-sm text-muted-foreground">{request.recApprover.email}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Recommending Status</h4>
                      {request.recApprovalStatus && (
                        <Badge variant={request.recApprovalStatus === "APPROVED" ? "default" : 
                                     request.recApprovalStatus === "DISAPPROVED" ? "destructive" : "secondary"}>
                          {APPROVAL_STATUS_LABELS[request.recApprovalStatus]}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Recommending Date</h4>
                      {request.recApprovalDate && (
                        <p>{format(new Date(request.recApprovalDate), "PPP")}</p>
                      )}
                    </div>
                  </div>
                )}

                {request.finalApprover && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Final Approver</h4>
                        <p>{request.finalApprover.name}</p>
                        <p className="text-sm text-muted-foreground">{request.finalApprover.email}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Final Status</h4>
                        {request.finalApprovalStatus && (
                          <Badge variant={request.finalApprovalStatus === "APPROVED" ? "default" : 
                                       request.finalApprovalStatus === "DISAPPROVED" ? "destructive" : "secondary"}>
                            {APPROVAL_STATUS_LABELS[request.finalApprovalStatus]}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Final Date</h4>
                        {request.finalApprovalDate && (
                          <p>{format(new Date(request.finalApprovalDate), "PPP")}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Items ({request.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                    {request.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.itemCode}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="whitespace-pre-wrap break-words">{item.description}</div>
                        </TableCell>
                        <TableCell>{item.uom}</TableCell>
                        <TableCell className="text-right">{Number(item.quantity).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {item.unitPrice ? `₱${Number(item.unitPrice).toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.totalPrice ? `₱${Number(item.totalPrice).toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px]">
                          {item.remarks && (
                            <div className="whitespace-pre-wrap break-words text-sm">{item.remarks}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Items Subtotal:</span>
                  <span>₱{itemsTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Freight:</span>
                  <span>₱{Number(request.freight).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-₱{Number(request.discount).toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total Amount:</span>
                  <span>₱{Number(request.total).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timestamps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-muted-foreground">Created At</h4>
                  <p>{format(new Date(request.createdAt), "PPP 'at' p")}</p>
                </div>
                <div>
                  <h4 className="font-medium text-muted-foreground">Last Updated</h4>
                  <p>{format(new Date(request.updatedAt), "PPP 'at' p")}</p>
                </div>
                {request.dateApproved && (
                  <div>
                    <h4 className="font-medium text-muted-foreground">Date Approved</h4>
                    <p>{format(new Date(request.dateApproved), "PPP 'at' p")}</p>
                  </div>
                )}
                {request.dateReceived && (
                  <div>
                    <h4 className="font-medium text-muted-foreground">Date Received</h4>
                    <p>{format(new Date(request.dateReceived), "PPP 'at' p")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}