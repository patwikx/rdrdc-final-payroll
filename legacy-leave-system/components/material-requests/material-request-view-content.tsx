"use client"

import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { MaterialRequest } from "@/types/material-request-types"
import { 
  FileText, 
  Building2, 
  User, 
  Calendar, 
  Package, 
  DollarSign,
  CheckCircle2,
  ClipboardCheck} from "lucide-react"

interface MaterialRequestViewContentProps {
  materialRequest: MaterialRequest
}

export function MaterialRequestViewContent({ materialRequest }: MaterialRequestViewContentProps) {
  return (
    <div className="space-y-6 px-2 sm:px-0">
      {/* Compact Header - All in one row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Document No.
          </label>
          <p className="mt-1 text-lg font-bold">{materialRequest.docNo}</p>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{materialRequest.series}</Badge>
            <Badge variant="outline" className="text-xs">{materialRequest.type}</Badge>
          </div>
        </div>
        
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Organization
          </label>
          <p className="mt-1 font-semibold">{materialRequest.businessUnit.name}</p>
          <p className="text-sm text-muted-foreground">{materialRequest.department?.name || "No Department"}</p>
        </div>
        
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
            <User className="h-3 w-3" />
            Requested By
          </label>
          <p className="mt-1 font-semibold">{materialRequest.requestedBy.name}</p>
          <p className="text-sm text-muted-foreground">{materialRequest.requestedBy.employeeId}</p>
        </div>
        
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Dates
          </label>
          <p className="mt-1 text-sm"><span className="font-medium">Prepared:</span> {format(new Date(materialRequest.datePrepared), "MMM dd, yyyy")}</p>
          <p className="text-sm"><span className="font-medium">Required:</span> {format(new Date(materialRequest.dateRequired), "MMM dd, yyyy")}</p>
        </div>
      </div>

      {/* Secondary Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {materialRequest.chargeTo && (
          <div className="p-3 bg-muted/20 rounded border">
            <label className="text-xs font-medium text-muted-foreground uppercase">Charge To</label>
            <p className="mt-1 font-semibold">{materialRequest.chargeTo}</p>
          </div>
        )}
        {materialRequest.bldgCode && (
          <div className="p-3 bg-muted/20 rounded border">
            <label className="text-xs font-medium text-muted-foreground uppercase">Bldg Code</label>
            <p className="mt-1 font-semibold">{materialRequest.bldgCode}</p>
          </div>
        )}
        {materialRequest.purpose && (
          <div className="p-3 bg-muted/20 rounded border md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Purpose</label>
            <p className="mt-1 text-sm">{materialRequest.purpose}</p>
          </div>
        )}
        {materialRequest.deliverTo && (
          <div className="p-3 bg-muted/20 rounded border">
            <label className="text-xs font-medium text-muted-foreground uppercase">Deliver To</label>
            <p className="mt-1 text-sm">{materialRequest.deliverTo}</p>
          </div>
        )}
        {materialRequest.remarks && (
          <div className="p-3 bg-muted/20 rounded border">
            <label className="text-xs font-medium text-muted-foreground uppercase">Remarks</label>
            <p className="mt-1 text-sm">{materialRequest.remarks}</p>
          </div>
        )}
      </div>

      {/* Items Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold border-b pb-1">
          <Package className="h-4 w-4 text-orange-500" />
          Items
          <Badge variant="secondary" className="ml-2 text-xs">
            {materialRequest.items.length} {materialRequest.items.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>
        {/* Mobile Card View */}
        <div className="block sm:hidden">
          <div className="space-y-3">
              {materialRequest.items.map((item, index) => {
                const itemTotal = (item.unitPrice || 0) * item.quantity
                return (
                  <div key={item.id} className="border rounded-lg p-4 space-y-4 bg-gradient-to-r from-muted/20 to-muted/10 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {index + 1}
                          </div>
                          <Badge 
                            variant={item.itemCode ? "secondary" : "default"}
                            className="font-medium text-xs px-2 py-1"
                          >
                            {item.itemCode ? "Existing Item" : "New Item"}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Total</div>
                          <div className="font-bold text-lg">₱{itemTotal.toLocaleString()}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Item Code</div>
                            <div className="font-semibold">
                              {item.itemCode || (
                                <span className="text-muted-foreground italic">Auto-generated</span>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</div>
                            <div className="font-semibold">{item.description}</div>
                            {item.remarks && (
                              <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                                {item.remarks}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">UOM</div>
                            <div className="font-bold text-blue-700 dark:text-blue-300">{item.uom}</div>
                          </div>
                          <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quantity</div>
                            <div className="font-bold text-green-700 dark:text-green-300">{item.quantity}</div>
                          </div>
                          <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unit Price</div>
                            <div className="font-bold text-purple-700 dark:text-purple-300">₱{(item.unitPrice || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                  </div>
                )
              })}
            </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-hidden">
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                      #
                    </TableHead>
                    <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                      Item Code
                    </TableHead>
                    <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                      Description
                    </TableHead>
                    <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                      UOM
                    </TableHead>
                    <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                      Quantity
                    </TableHead>
                    <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                      Unit Price
                    </TableHead>
                    <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                      Type
                    </TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {materialRequest.items.map((item, index) => {
                  const itemTotal = (item.unitPrice || 0) * item.quantity
                  return (
                    <TableRow 
                      key={item.id} 
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="h-14 px-4 align-middle">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell className="h-14 px-4 align-middle">
                        <div className="font-medium">
                          {item.itemCode || (
                            <span className="text-muted-foreground italic">Auto-generated</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="h-14 px-4 align-middle">
                        <div className="max-w-[200px]">
                          <div className="font-medium">{item.description}</div>
                          {item.remarks && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.remarks}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="h-14 px-4 align-middle">
                        <span className="font-medium">{item.uom}</span>
                      </TableCell>
                      <TableCell className="h-14 px-4 align-middle">
                        <span className="font-medium">{item.quantity}</span>
                      </TableCell>
                      <TableCell className="h-14 px-4 align-middle">
                        <span className="font-medium">₱{(item.unitPrice || 0).toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="h-14 px-4 align-middle">
                        <span className="font-semibold">₱{itemTotal.toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="h-14 px-4 align-middle">
                        <Badge 
                          variant={item.itemCode ? "secondary" : "default"}
                          className="font-medium"
                        >
                          {item.itemCode ? "Existing" : "New"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                </TableBody>
              </Table>
            </div>
        </div>
      </div>

      {/* Store Use Review Information - Only show for store use requests that have been reviewed */}
      {materialRequest.isStoreUse && materialRequest.reviewer && (
        <div className="p-4 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30 rounded-lg border-2 border-sky-200 dark:border-sky-800">
          <div className="flex items-center gap-2 font-semibold mb-3">
            <ClipboardCheck className="h-4 w-4 text-sky-500" />
            Store Use Review
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Reviewed By</label>
              <p className="mt-1 font-bold text-sky-700 dark:text-sky-300">{materialRequest.reviewer.name}</p>
              <p className="text-xs text-muted-foreground">{materialRequest.reviewer.employeeId}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Review Status</label>
              <div className="mt-1">
                <Badge 
                  variant="outline" 
                  className={materialRequest.reviewStatus === 'APPROVED'
                    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300"
                    : "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300"
                  }
                >
                  {materialRequest.reviewStatus === 'APPROVED' ? 'Reviewed' : materialRequest.reviewStatus}
                </Badge>
              </div>
              {materialRequest.reviewedAt && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(materialRequest.reviewedAt), "MMM dd, yyyy")}
                </p>
              )}
            </div>
            {materialRequest.reviewRemarks && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Remarks</label>
                <p className="mt-1 text-sm">{materialRequest.reviewRemarks}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget Approval Information - Only show if budget approval exists */}
      {materialRequest.budgetApprover && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 font-semibold mb-3">
            <DollarSign className="h-4 w-4 text-blue-500" />
            Budget Approval
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Approved By</label>
              <p className="mt-1 font-bold text-blue-700 dark:text-blue-300">{materialRequest.budgetApprover.name}</p>
              <p className="text-xs text-muted-foreground">{materialRequest.budgetApprover.employeeId}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Budget Status</label>
              <div className="mt-1">
                <Badge 
                  variant="outline" 
                  className={materialRequest.isWithinBudget 
                    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300"
                    : "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300"
                  }
                >
                  {materialRequest.isWithinBudget ? "Within Budget" : "Not Within Budget"}
                </Badge>
              </div>
              {materialRequest.budgetApprovalDate && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(materialRequest.budgetApprovalDate), "MMM dd, yyyy")}
                </p>
              )}
            </div>
            {materialRequest.budgetRemarks && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Remarks</label>
                <p className="mt-1 text-sm">{materialRequest.budgetRemarks}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financial Summary & Approvals in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Financial Summary */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2 font-semibold mb-3">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Financial Summary
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded">
              <label className="text-xs font-medium text-muted-foreground uppercase">Freight</label>
              <p className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">₱{materialRequest.freight.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded">
              <label className="text-xs font-medium text-muted-foreground uppercase">Discount</label>
              <p className="mt-1 text-lg font-bold text-red-700 dark:text-red-300">₱{materialRequest.discount.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded border-2 border-emerald-200 dark:border-emerald-800">
              <label className="text-xs font-medium text-muted-foreground uppercase">Total</label>
              <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">₱{materialRequest.total.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Approval Information */}
        {(materialRequest.recApprover || materialRequest.finalApprover) && (
          <div className="p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2 font-semibold mb-3">
              <CheckCircle2 className="h-4 w-4 text-indigo-500" />
              Approval Information
            </div>
            <div className="grid grid-cols-2 gap-3">
              {materialRequest.recApprover && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded border space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Recommending</label>
                    <p className="mt-1 font-bold text-indigo-700 dark:text-indigo-300">{materialRequest.recApprover.name}</p>
                    <p className="text-xs text-muted-foreground">{materialRequest.recApprover.employeeId}</p>
                  </div>
                  {materialRequest.recApprovalStatus && (
                    <div>
                      <Badge 
                        variant="outline" 
                        className={materialRequest.recApprovalStatus === 'APPROVED' 
                          ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300"
                          : materialRequest.recApprovalStatus === 'DISAPPROVED'
                          ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300"
                        }
                      >
                        {materialRequest.recApprovalStatus}
                      </Badge>
                    </div>
                  )}
                  {materialRequest.recApprovalDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(materialRequest.recApprovalDate), "MMM dd, yyyy")}
                    </p>
                  )}
                  {materialRequest.recApprovalRemarks && (
                    <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Remarks</label>
                      <p className="mt-1 text-xs text-indigo-900 dark:text-indigo-100">{materialRequest.recApprovalRemarks}</p>
                    </div>
                  )}
                </div>
              )}
              {materialRequest.finalApprover && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded border space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Final</label>
                    <p className="mt-1 font-bold text-emerald-700 dark:text-emerald-300">{materialRequest.finalApprover.name}</p>
                    <p className="text-xs text-muted-foreground">{materialRequest.finalApprover.employeeId}</p>
                  </div>
                  {materialRequest.finalApprovalStatus && (
                    <div>
                      <Badge 
                        variant="outline" 
                        className={materialRequest.finalApprovalStatus === 'APPROVED' 
                          ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300"
                          : materialRequest.finalApprovalStatus === 'DISAPPROVED'
                          ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300"
                        }
                      >
                        {materialRequest.finalApprovalStatus}
                      </Badge>
                    </div>
                  )}
                  {materialRequest.finalApprovalDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(materialRequest.finalApprovalDate), "MMM dd, yyyy")}
                    </p>
                  )}
                  {materialRequest.finalApprovalRemarks && (
                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                      <label className="text-xs font-medium text-muted-foreground uppercase">Remarks</label>
                      <p className="mt-1 text-xs text-emerald-900 dark:text-emerald-100">{materialRequest.finalApprovalRemarks}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}