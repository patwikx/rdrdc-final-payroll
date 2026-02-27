/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Edit, X, AlertCircle, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MaterialRequest } from "@/types/material-request-types"
import { REQUEST_STATUS_COLORS, REQUEST_STATUS_LABELS } from "@/types/material-request-types"
import { MRSRequestStatus, ApprovalStatus } from "@prisma/client"
import { MaterialRequestEditForm } from "./material-request-edit-form"
import { MaterialRequestViewContent } from "./material-request-view-content"
import { MaterialRequestEditDescriptions } from "./material-request-edit-descriptions"
import { format } from "date-fns"

interface MaterialRequestDetailPageProps {
  materialRequest: MaterialRequest
  businessUnitId: string
  currentUserId: string
  isPurchaser: boolean
}

export function MaterialRequestDetailPage({
  materialRequest,
  currentUserId,
  isPurchaser,
}: MaterialRequestDetailPageProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingDescriptions, setIsEditingDescriptions] = useState(false)

  // Check if any approval has been made (including budget approval)
  const hasAnyApproval = 
    materialRequest.budgetApprovalStatus === ApprovalStatus.APPROVED ||
    materialRequest.recApprovalStatus === ApprovalStatus.APPROVED || 
    materialRequest.finalApprovalStatus === ApprovalStatus.APPROVED

  // Requestor can edit if:
  // 1. They are the original requestor
  // 2. AND no approvals have been made yet (budget, rec, or final)
  // 3. AND status is not DISAPPROVED, POSTED, or DEPLOYED
  const isRequestor = materialRequest.requestedById === currentUserId
  const canEditAsRequestor = isRequestor && !hasAnyApproval && 
    materialRequest.status !== MRSRequestStatus.DISAPPROVED &&
    materialRequest.status !== MRSRequestStatus.POSTED &&
    materialRequest.status !== MRSRequestStatus.DEPLOYED

  // Purchaser can always prompt for edit (via mark for edit feature)
  // But for full edit, only if marked for edit by themselves
  const canEdit = canEditAsRequestor

  // Can edit descriptions if marked for edit by purchaser
  const canEditDescriptions = materialRequest.isMarkedForEdit && !materialRequest.editCompletedAt && isRequestor

  const handleEditSuccess = () => {
    setIsEditing(false)
    router.refresh()
  }

  const handleDescriptionEditSuccess = () => {
    setIsEditingDescriptions(false)
    router.refresh()
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Material Request - ${materialRequest.docNo}</title>
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
            <p>${materialRequest.businessUnit.name}</p>
          </div>
          
          <div class="info-grid">
            <div>
              <div class="info-row">
                <span class="info-label">Document No:</span>
                <span class="info-value">${materialRequest.docNo}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Type:</span>
                <span class="info-value">${materialRequest.type}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">${materialRequest.status}</span>
              </div>
            </div>
            <div>
              <div class="info-row">
                <span class="info-label">Date Prepared:</span>
                <span class="info-value">${format(new Date(materialRequest.datePrepared), "MMM dd, yyyy")}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date Required:</span>
                <span class="info-value">${format(new Date(materialRequest.dateRequired), "MMM dd, yyyy")}</span>
              </div>
            </div>
          </div>
          
          <div class="info-grid">
            <div>
              <div class="info-row">
                <span class="info-label">Requested By:</span>
                <span class="info-value">${materialRequest.requestedBy.name} (${materialRequest.requestedBy.employeeId})</span>
              </div>
              ${materialRequest.bldgCode ? `
              <div class="info-row">
                <span class="info-label">Building Code:</span>
                <span class="info-value">${materialRequest.bldgCode}</span>
              </div>
              ` : ''}
            </div>
            <div>
              <div class="info-row">
                <span class="info-label">Department:</span>
                <span class="info-value">${materialRequest.department?.name || "N/A"}</span>
              </div>
            </div>
          </div>
          
          ${materialRequest.purpose ? `
          <div class="remarks">
            <div class="remarks-label">Purpose:</div>
            <div>${materialRequest.purpose}</div>
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
              ${materialRequest.items.map(item => {
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
                const grandTotal = materialRequest.items.reduce((sum, item) => sum + ((item.unitPrice || 0) * item.quantity), 0)
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
          
          ${materialRequest.supplierName || materialRequest.purchaseOrderNumber ? `
          <div class="info-grid">
            ${materialRequest.supplierName ? `
            <div class="info-row">
              <span class="info-label">Supplier:</span>
              <span class="info-value">${materialRequest.supplierName}</span>
            </div>
            ` : ''}
            ${materialRequest.purchaseOrderNumber ? `
            <div class="info-row">
              <span class="info-label">PO Number:</span>
              <span class="info-value">${materialRequest.purchaseOrderNumber}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}
          
          ${materialRequest.remarks ? `
          <div class="remarks">
            <div class="remarks-label">Remarks:</div>
            <div>${materialRequest.remarks}</div>
          </div>
          ` : ''}
          
          ${materialRequest.recApprover || materialRequest.finalApprover ? `
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #ccc;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 9pt;">Approval Information:</div>
            <div class="info-grid">
              ${materialRequest.recApprover ? `
              <div>
                <div class="info-row">
                  <span class="info-label">Recommending:</span>
                  <span class="info-value">${materialRequest.recApprover.name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="font-weight: bold; color: ${materialRequest.recApprovalStatus === 'APPROVED' ? '#16a34a' : materialRequest.recApprovalStatus === 'DISAPPROVED' ? '#dc2626' : '#6b7280'};">
                    ${materialRequest.recApprovalStatus || 'PENDING'}
                  </span>
                </div>
                ${materialRequest.recApprovalDate ? `
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${format(new Date(materialRequest.recApprovalDate), "MMM dd, yyyy")}</span>
                </div>
                ` : ''}
              </div>
              ` : ''}
              ${materialRequest.finalApprover ? `
              <div>
                <div class="info-row">
                  <span class="info-label">Final Approver:</span>
                  <span class="info-value">${materialRequest.finalApprover.name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="font-weight: bold; color: ${materialRequest.finalApprovalStatus === 'APPROVED' ? '#16a34a' : materialRequest.finalApprovalStatus === 'DISAPPROVED' ? '#dc2626' : '#6b7280'};">
                    ${materialRequest.finalApprovalStatus || 'PENDING'}
                  </span>
                </div>
                ${materialRequest.finalApprovalDate ? `
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${format(new Date(materialRequest.finalApprovalDate), "MMM dd, yyyy")}</span>
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

  // Show print button if request has been approved
  const showPrintButton = hasAnyApproval

  return (
    <div className="w-full max-w-none px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold">{materialRequest.docNo}</h1>
            <p className="text-muted-foreground">
              {materialRequest.type === "ITEM" ? "Item Request" : "Service Request"}
            </p>
          </div>
          <Badge 
            variant="secondary" 
            className={REQUEST_STATUS_COLORS[materialRequest.status]}
          >
            {REQUEST_STATUS_LABELS[materialRequest.status]}
          </Badge>
          {materialRequest.isStoreUse && (
            <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
              Store Use
            </Badge>
          )}
          {materialRequest.isWithinBudget !== null && (
            <Badge 
              variant="outline" 
              className={materialRequest.isWithinBudget 
                ? "gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                : "gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
              }
            >
              {materialRequest.isWithinBudget ? "Within Budget" : "Not Within Budget"}
            </Badge>
          )}
          {materialRequest.isMarkedForEdit && !materialRequest.editCompletedAt && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Needs Edit
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          {isEditing ? (
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel Edit
            </Button>
          ) : isEditingDescriptions ? (
            <Button
              variant="outline"
              onClick={() => setIsEditingDescriptions(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <>
              {showPrintButton && (
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              )}
              {canEditDescriptions && (
                <Button
                  onClick={() => setIsEditingDescriptions(true)}
                  variant="destructive"
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Descriptions
                </Button>
              )}
              {canEdit && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Request
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Alert for marked for edit */}
      {materialRequest.isMarkedForEdit && !materialRequest.editCompletedAt && !isEditingDescriptions && (
        <div className="mb-6 p-4 border-l-4 border-destructive bg-destructive/10 rounded">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-destructive">This request has been marked for edit by the purchaser</p>
              {materialRequest.markedForEditReason && (() => {
                const parts = materialRequest.markedForEditReason.split('\n\nItems to edit:\n')
                const reason = parts[0]
                const items = parts[1]
                
                return (
                  <div className="text-sm space-y-1">
                    {reason && reason !== 'Items to edit:' && (
                      <p><span className="font-medium">Reason:</span> {reason}</p>
                    )}
                    {items && (
                      <p><span className="font-medium">Items to edit:</span> {items}</p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <MaterialRequestEditForm
          materialRequest={materialRequest}
          onSuccess={handleEditSuccess}
          onCancel={() => setIsEditing(false)}
        />
      ) : isEditingDescriptions ? (
        <MaterialRequestEditDescriptions
          materialRequest={materialRequest}
          onSuccess={handleDescriptionEditSuccess}
          onCancel={() => setIsEditingDescriptions(false)}
        />
      ) : (
        <MaterialRequestViewContent materialRequest={materialRequest} />
      )}
    </div>
  )
}