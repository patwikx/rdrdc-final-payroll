"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Package, Eye, CheckCircle, MoreVertical, Printer, AlertCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { MarkAsServedDialog } from "./mark-as-served-dialog"
import { MarkForEditDialog } from "./mark-for-edit-dialog"
import { MaterialRequest } from "@/types/material-request-types"

interface ToServeRequestsClientProps {
  initialRequests: MaterialRequest[]
  userRole: string
  isPurchaser: boolean
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

export function ToServeRequestsClient({ initialRequests, userRole, isPurchaser, businessUnitId }: ToServeRequestsClientProps) {
  const [requests, setRequests] = useState<MaterialRequest[]>(initialRequests)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null)
  const [isMarkAsServedDialogOpen, setIsMarkAsServedDialogOpen] = useState(false)
  const [isMarkForEditDialogOpen, setIsMarkForEditDialogOpen] = useState(false)
  const router = useRouter()

  const filteredRequests = useMemo(() => {
    if (!searchTerm) return requests
    
    return requests.filter(request => 
      request.docNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requestedBy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.department?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [requests, searchTerm])

  const handleMarkAsServed = (request: MaterialRequest) => {
    setSelectedRequest(request)
    setIsMarkAsServedDialogOpen(true)
  }

  const handleMarkAsServedSuccess = () => {
    if (selectedRequest) {
      // Remove the request from the list since it's now served
      setRequests(prev => prev.filter(req => req.id !== selectedRequest.id))
      router.refresh()
    }
    setSelectedRequest(null)
  }

  const handleMarkForEdit = (request: MaterialRequest) => {
    setSelectedRequest(request)
    setIsMarkForEditDialogOpen(true)
  }

  const handleMarkForEditSuccess = () => {
    router.refresh()
    setSelectedRequest(null)
  }

  const handlePrint = (request: MaterialRequest) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Material Request - ${request.docNo}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 0.5in;
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: Arial, sans-serif;
              font-size: 10pt;
              line-height: 1.4;
              color: #000;
              max-height: 5.5in;
              padding: 0.25in;
            }
            
            .header {
              text-align: center;
              margin-bottom: 16px;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
            }
            
            .header h1 {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 4px;
            }
            
            .header p {
              font-size: 9pt;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-bottom: 12px;
              font-size: 9pt;
            }
            
            .info-row {
              display: flex;
            }
            
            .info-label {
              font-weight: bold;
              width: 110px;
              flex-shrink: 0;
            }
            
            .info-value {
              flex: 1;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 9pt;
            }
            
            th, td {
              border: 1px solid #000;
              padding: 4px 6px;
              text-align: left;
            }
            
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            td.center {
              text-align: center;
            }
            
            td.right {
              text-align: right;
            }
            
            .remarks {
              margin-bottom: 12px;
              font-size: 9pt;
            }
            
            .remarks-label {
              font-weight: bold;
              margin-bottom: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MATERIAL REQUEST SLIP</h1>
            <p>${request.businessUnit.name}</p>
          </div>
          
          <div class="info-grid">
            <div>
              <div class="info-row">
                <span class="info-label">Document No:</span>
                <span class="info-value">${request.docNo}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Type:</span>
                <span class="info-value">${request.type}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">${request.status}</span>
              </div>
            </div>
            <div>
              <div class="info-row">
                <span class="info-label">Date Prepared:</span>
                <span class="info-value">${format(new Date(request.datePrepared), "MMM dd, yyyy")}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date Required:</span>
                <span class="info-value">${format(new Date(request.dateRequired), "MMM dd, yyyy")}</span>
              </div>
            </div>
          </div>
          
          <div class="info-grid">
            <div>
              <div class="info-row">
                <span class="info-label">Requested By:</span>
                <span class="info-value">${request.requestedBy.name} (${request.requestedBy.employeeId})</span>
              </div>
              ${request.bldgCode ? `
              <div class="info-row">
                <span class="info-label">Building Code:</span>
                <span class="info-value">${request.bldgCode}</span>
              </div>
              ` : ''}
            </div>
            <div>
              <div class="info-row">
                <span class="info-label">Department:</span>
                <span class="info-value">${request.department?.name || "N/A"}</span>
              </div>
            </div>
          </div>
          
          ${request.purpose ? `
          <div class="remarks">
            <div class="remarks-label">Purpose:</div>
            <div>${request.purpose}</div>
          </div>
          ` : ''}
          
          <table>
            <thead>
              <tr>
                <th style="width: 12%">Item Code</th>
                <th style="width: 28%">Description</th>
                <th style="width: 8%" class="center">UOM</th>
                <th style="width: 8%" class="center">Qty</th>
                <th style="width: 12%" class="right">Unit Price</th>
                <th style="width: 12%" class="right">Total</th>
                <th style="width: 20%">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${request.items.map(item => {
                const unitPrice = item.unitPrice || 0
                const total = unitPrice * item.quantity
                return `
                <tr>
                  <td>${item.itemCode || "-"}</td>
                  <td>${item.description}</td>
                  <td class="center">${item.uom}</td>
                  <td class="right">${item.quantity}</td>
                  <td class="right">${unitPrice > 0 ? '₱' + unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                  <td class="right">${total > 0 ? '₱' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                  <td>${item.remarks || "-"}</td>
                </tr>
              `}).join('')}
              ${(() => {
                const grandTotal = request.items.reduce((sum, item) => sum + ((item.unitPrice || 0) * item.quantity), 0)
                return grandTotal > 0 ? `
                <tr>
                  <td colspan="5" class="right" style="font-weight: bold;">Grand Total:</td>
                  <td class="right" style="font-weight: bold;">₱${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
                ` : ''
              })()}
            </tbody>
          </table>
          
          ${request.supplierName || request.purchaseOrderNumber ? `
          <div class="info-grid">
            ${request.supplierName ? `
            <div class="info-row">
              <span class="info-label">Supplier:</span>
              <span class="info-value">${request.supplierName}</span>
            </div>
            ` : ''}
            ${request.purchaseOrderNumber ? `
            <div class="info-row">
              <span class="info-label">PO Number:</span>
              <span class="info-value">${request.purchaseOrderNumber}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}
          
          ${request.remarks ? `
          <div class="remarks">
            <div class="remarks-label">Remarks:</div>
            <div>${request.remarks}</div>
          </div>
          ` : ''}
          
          ${request.recApprover || request.finalApprover ? `
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #ccc;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 9pt;">Approval Information:</div>
            <div class="info-grid">
              ${request.recApprover ? `
              <div>
                <div class="info-row">
                  <span class="info-label">Recommending:</span>
                  <span class="info-value">${request.recApprover.name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="font-weight: bold; color: ${request.recApprovalStatus === 'APPROVED' ? '#16a34a' : request.recApprovalStatus === 'DISAPPROVED' ? '#dc2626' : '#6b7280'};">
                    ${request.recApprovalStatus || 'PENDING'}
                  </span>
                </div>
                ${request.recApprovalDate ? `
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${format(new Date(request.recApprovalDate), "MMM dd, yyyy")}</span>
                </div>
                ` : ''}
              </div>
              ` : ''}
              ${request.finalApprover ? `
              <div>
                <div class="info-row">
                  <span class="info-label">Final Approver:</span>
                  <span class="info-value">${request.finalApprover.name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="font-weight: bold; color: ${request.finalApprovalStatus === 'APPROVED' ? '#16a34a' : request.finalApprovalStatus === 'DISAPPROVED' ? '#dc2626' : '#6b7280'};">
                    ${request.finalApprovalStatus || 'PENDING'}
                  </span>
                </div>
                ${request.finalApprovalDate ? `
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${format(new Date(request.finalApprovalDate), "MMM dd, yyyy")}</span>
                </div>
                ` : ''}
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}
          
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  const canMarkAsServed = (role: string, hasPurchaserPermission: boolean): boolean => {
    return role === "ADMIN" || hasPurchaserPermission
  }

  const getRequestTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      PURCHASE: { label: "Purchase", variant: "default" },
      STOCK: { label: "Stock", variant: "secondary" },
      BOTH: { label: "Both", variant: "outline" }
    }
    
    const config = typeMap[type] || { label: type, variant: "outline" as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="flex-1 space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Requests to Serve</h1>
          <p className="text-sm text-muted-foreground">
            Material requests ready to be served by the purchaser
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by document number, purpose, requester, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results count and Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Showing {filteredRequests.length} of {requests.length} requests to serve
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"></div>
            <span className="text-muted-foreground">Waiting for Edit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20"></div>
            <span className="text-muted-foreground">Edit Completed</span>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="rounded-md border hidden sm:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Date Requested</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "No requests match your search criteria" : "No requests to serve"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => {
                // Determine row styling based on edit status
                const isMarkedForEdit = request.isMarkedForEdit && !request.editCompletedAt
                const isEditCompleted = request.isMarkedForEdit && request.editCompletedAt
                const rowClassName = isMarkedForEdit 
                  ? "bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-950/30"
                  : isEditCompleted
                  ? "bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30"
                  : ""
                
                const borderClassName = isMarkedForEdit
                  ? "border-l-4 border-yellow-500"
                  : isEditCompleted
                  ? "border-l-4 border-green-500"
                  : ""
                
                return (
                  <TableRow key={request.id} className={rowClassName}>
                    <TableCell className={borderClassName}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono font-medium">{request.docNo}</span>
                      </div>
                    </TableCell>
                  <TableCell>{getRequestTypeBadge(request.type)}</TableCell>
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
                    {request.department ? (
                      <span className="font-medium">{request.department.name}</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(request.createdAt), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate" title={request.purpose || undefined}>
                      {request.purpose || <span className="text-muted-foreground">No purpose specified</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {request.items?.length || 0} {(request.items?.length || 0) === 1 ? 'item' : 'items'}
                    </Badge>
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
                          {canMarkAsServed(userRole, isPurchaser) && (
                            <>
                              <DropdownMenuItem onClick={() => handleMarkAsServed(request)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Served
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMarkForEdit(request)}>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Return for Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}

                          <DropdownMenuItem onClick={() => router.push(`/${businessUnitId}/material-requests/${request.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handlePrint(request)}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print
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
              <p className="text-muted-foreground">
                {searchTerm ? "No requests match your search criteria" : "No requests to serve"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            // Determine card styling based on edit status
            const isMarkedForEdit = request.isMarkedForEdit && !request.editCompletedAt
            const isEditCompleted = request.isMarkedForEdit && request.editCompletedAt
            const cardClassName = isMarkedForEdit 
              ? "border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
              : isEditCompleted
              ? "border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20"
              : ""
            
            return (
              <Card key={request.id} className={cardClassName}>
                <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base font-mono">{request.docNo}</CardTitle>
                  </div>
                  {getRequestTypeBadge(request.type)}
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
                    <p className="font-medium">
                      {request.department?.name || <span className="text-muted-foreground">N/A</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date Requested:</span>
                    <p className="font-medium">{format(new Date(request.createdAt), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Items:</span>
                    <p className="font-medium">
                      {request.items?.length || 0} {(request.items?.length || 0) === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>

                {request.purpose && (
                  <div>
                    <span className="text-muted-foreground text-sm">Purpose:</span>
                    <p className="text-sm mt-1">{request.purpose}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {canMarkAsServed(userRole, isPurchaser) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleMarkAsServed(request)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Served
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canMarkAsServed(userRole, isPurchaser) && (
                        <>
                          <DropdownMenuItem onClick={() => handleMarkForEdit(request)}>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Return for Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={() => router.push(`/${businessUnitId}/material-requests/${request.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePrint(request)}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print
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

      {/* Mark as Served Dialog */}
      {selectedRequest && (
        <>
          <MarkAsServedDialog
            request={selectedRequest}
            open={isMarkAsServedDialogOpen}
            onOpenChange={setIsMarkAsServedDialogOpen}
            onSuccess={handleMarkAsServedSuccess}
            businessUnitId={businessUnitId}
          />
          <MarkForEditDialog
            request={selectedRequest}
            open={isMarkForEditDialogOpen}
            onOpenChange={setIsMarkForEditDialogOpen}
            onSuccess={handleMarkForEditSuccess}
          />
        </>
      )}
    </div>
  )
}