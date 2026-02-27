"use client"

import { useState, useRef, useEffect } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DigitalSignaturePad } from "./digital-signature-pad"
import { Download, FileText, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { saveAcknowledgement } from "@/lib/actions/mrs-actions/material-request-actions"
import { Separator } from "../ui/separator"

interface MaterialRequest {
  id: string
  docNo: string
  series: string
  type: string
  status: string
  datePrepared: Date | string
  dateRequired: Date | string
  dateReceived?: Date | string | null
  requestedById: string
  acknowledgedAt?: Date | string | null
  acknowledgedById?: string | null
  signatureData?: string | null
  businessUnit: {
    name: string
    code: string
  }
  department?: {
    name: string
    code: string
  } | null
  requestedBy: {
    name: string
    email: string | null
    employeeId: string
  }
  chargeTo?: string | null
  purpose?: string | null
  deliverTo?: string | null
  total: number
  items: Array<{
    id: string
    itemCode?: string | null
    description: string
    uom: string
    quantity: number
    unitPrice?: number | null
    totalPrice?: number | null
    remarks?: string | null
  }>
}

interface AcknowledgementDocumentProps {
  materialRequest: MaterialRequest
  userRole: string
}

export function AcknowledgementDocument({ materialRequest, userRole }: AcknowledgementDocumentProps) {
  const [signature, setSignature] = useState<string | null>(null)
  const [isAcknowledged, setIsAcknowledged] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [acknowledgedAt, setAcknowledgedAt] = useState<Date | null>(null)
  const documentRef = useRef<HTMLDivElement>(null)

  // Load existing acknowledgement data
  useEffect(() => {
    if (materialRequest.acknowledgedAt && materialRequest.signatureData) {
      setIsAcknowledged(true)
      setSignature(materialRequest.signatureData)
      setAcknowledgedAt(new Date(materialRequest.acknowledgedAt))
    }
  }, [materialRequest])

  const handleSignatureChange = (signatureData: string | null) => {
    setSignature(signatureData)
  }

  const handleAcknowledge = async () => {
    if (!signature) {
      toast.error("Please provide your digital signature")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await saveAcknowledgement(materialRequest.id, signature)
      
      if (result.success) {
        setIsAcknowledged(true)
        toast.success("Acknowledgement submitted successfully")
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error submitting acknowledgement:", error)
      toast.error("Failed to submit acknowledgement")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const signatureImg = signature ? `<img src="${signature}" alt="Digital Signature" style="max-width: 200px; max-height: 100px; display: block; margin: 0 auto;">` : ''
    const acknowledgedDate = acknowledgedAt ? format(acknowledgedAt, "PPP 'at' p") : format(new Date(), "PPP 'at' p")

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Material Request Acknowledgement - ${materialRequest.docNo}</title>
          <style>
            @page {
              size: legal;
              margin: 0.75in;
            }
            
            body {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.4;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
            }
            
            .document {
              max-width: 100%;
              margin: 0 auto;
            }
            
            .header {
              text-align: center;
              margin-bottom: 25px;
              border-bottom: 2px solid #000;
              padding-bottom: 15px;
            }
            
            .header h1 {
              font-size: 18pt;
              font-weight: bold;
              margin: 0 0 10px 0;
              text-transform: uppercase;
            }
            
            .header h2 {
              font-size: 14pt;
              font-weight: bold;
              margin: 0 0 5px 0;
            }
            
            .header p {
              font-size: 11pt;
              margin: 0;
              font-style: italic;
            }
            
            .info-section {
              margin-bottom: 20px;
            }
            
            .info-grid {
              display: table;
              width: 100%;
              margin-bottom: 15px;
            }
            
            .info-row {
              display: table-row;
            }
            
            .info-label {
              display: table-cell;
              width: 25%;
              font-weight: bold;
              padding: 3px 10px 3px 0;
              vertical-align: top;
            }
            
            .info-value {
              display: table-cell;
              padding: 3px 0;
              vertical-align: top;
            }
            
            .section-title {
              font-size: 14pt;
              font-weight: bold;
              margin: 20px 0 12px 0;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
            }
            
            th, td {
              border: 1px solid #000;
              padding: 6px;
              text-align: left;
              vertical-align: top;
              font-size: 11pt;
            }
            
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: center;
            }
            
            .text-right {
              text-align: right;
            }
            
            .text-center {
              text-align: center;
            }
            
            .total-row {
              font-weight: bold;
              background-color: #f9f9f9;
            }
            
            .acknowledgement-text {
              background-color: #f8f8f8;
              padding: 12px;
              border: 1px solid #ccc;
              margin: 15px 0;
              text-align: justify;
              line-height: 1.5;
              font-size: 11pt;
            }
            
            .signature-section {
              margin-top: 30px;
              display: table;
              width: 100%;
            }
            
            .signature-left {
              display: table-cell;
              width: 50%;
              vertical-align: top;
              padding-right: 20px;
            }
            
            .signature-right {
              display: table-cell;
              width: 50%;
              vertical-align: top;
              padding-left: 20px;
            }
            
            .signature-box {
              min-height: 100px;
              padding: 8px;
              text-align: center;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .signature-label {
              font-weight: bold;
              margin-bottom: 10px;
            }
            
            .signature-name {
              border-top: 1px solid #000;
              padding-top: 5px;
              margin-top: 10px;
              text-align: center;
            }
            
            .signature-title {
              font-size: 10pt;
              color: #666;
              text-align: center;
            }
            
            .footer-note {
              margin-top: 20px;
              font-size: 9pt;
              color: #666;
              text-align: center;
              border-top: 1px solid #ccc;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="document">
            <!-- Header -->
            <div class="header">
              <h1>Material Request Acknowledgement</h1>
              <h2>${materialRequest.businessUnit.name}</h2>
              <p>Acknowledgement of Receipt for Material Request</p>
            </div>

            <!-- Document Information -->
            <div class="info-section">
              <div class="info-grid">
                <div class="info-row">
                  <div class="info-label">Document No:</div>
                  <div class="info-value">${materialRequest.docNo}</div>
                  <div class="info-label">Date Prepared:</div>
                  <div class="info-value">${format(new Date(materialRequest.datePrepared), "PPP")}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Series:</div>
                  <div class="info-value">${materialRequest.series}</div>
                  <div class="info-label">Date Required:</div>
                  <div class="info-value">${format(new Date(materialRequest.dateRequired), "PPP")}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Type:</div>
                  <div class="info-value">${materialRequest.type}</div>
                  <div class="info-label">Date Received:</div>
                  <div class="info-value">${materialRequest.dateReceived ? format(new Date(materialRequest.dateReceived), "PPP") : "N/A"}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Status:</div>
                  <div class="info-value">${materialRequest.status}</div>
                  <div class="info-label">Department:</div>
                  <div class="info-value">${materialRequest.department?.name || "N/A"}</div>
                </div>
              </div>
            </div>

            <!-- Requestee Information -->
            <div class="section-title">Requestee Information</div>
            <div class="info-grid">
              <div class="info-row">
                <div class="info-label">Name:</div>
                <div class="info-value">${materialRequest.requestedBy.name}</div>
                <div class="info-label">Employee ID:</div>
                <div class="info-value">${materialRequest.requestedBy.employeeId}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Email:</div>
                <div class="info-value">${materialRequest.requestedBy.email || 'N/A'}</div>
                <div class="info-label"></div>
                <div class="info-value"></div>
              </div>
              ${materialRequest.chargeTo ? `
              <div class="info-row">
                <div class="info-label">Charge To:</div>
                <div class="info-value">${materialRequest.chargeTo}</div>
                <div class="info-label"></div>
                <div class="info-value"></div>
              </div>
              ` : ''}
            </div>

            <!-- Items Received -->
            <div class="section-title">Items Received</div>
            <table>
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Description</th>
                  <th>UOM</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${materialRequest.items.map(item => `
                  <tr>
                    <td class="text-center">${item.itemCode || "N/A"}</td>
                    <td>${item.description}${item.remarks ? `<br><small style="color: #666;">${item.remarks}</small>` : ''}</td>
                    <td class="text-center">${item.uom}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${item.unitPrice ? `₱${item.unitPrice.toLocaleString()}` : "N/A"}</td>
                    <td class="text-right">${item.totalPrice ? `₱${item.totalPrice.toLocaleString()}` : "N/A"}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="5" class="text-right"><strong>Total Amount:</strong></td>
                  <td class="text-right"><strong>₱${materialRequest.total.toLocaleString()}</strong></td>
                </tr>
              </tbody>
            </table>

            <!-- Acknowledgement Statement -->
            <div class="section-title">Acknowledgement</div>
            <div class="acknowledgement-text">
              I hereby acknowledge that I have received all the items listed above in good condition 
              and in the quantities specified. I confirm that the materials received match the 
              description and specifications in the material request. By signing below, I accept 
              full responsibility for the received items.
            </div>

            <!-- Signature Section -->
            <div class="signature-section">
              <div class="signature-left">
                <div class="signature-label">Digital Signature:</div>
                <div class="signature-box">
                  ${signatureImg}
                </div>
                <div class="signature-name">
                  <strong>${materialRequest.requestedBy.name}</strong>
                </div>
                <div class="signature-title">Requestee</div>
              </div>
              
              <div class="signature-right">
                <div class="signature-label">Date & Time:</div>
                <div style="font-size: 13pt; font-weight: bold; margin: 15px 0;">
                  ${acknowledgedDate}
                </div>
                <div style="margin-top: 25px;">
                  <strong>This document serves as official acknowledgement of receipt.</strong>
                </div>
              </div>
            </div>

            <div class="footer-note">
              This is a computer-generated document and is valid without signature when digitally signed.
            </div>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    
    // Wait for content and images to load then print
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 500)
  }

  const handleDownloadPDF = () => {
    // This would typically generate and download a PDF
    toast.info("PDF download functionality would be implemented here")
  }

  return (
    <div className="max-w-4xl mx-auto acknowledgement-container">
      {/* Action Buttons - Hidden in print */}
      <div className="flex justify-between items-center mb-6 print:hidden no-print">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Material Request Acknowledgement</h1>
        </div>
        <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Print
          </Button>
          {!isAcknowledged && (
            <Button 
              onClick={handleAcknowledge}
              disabled={!signature || isSubmitting}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isSubmitting ? "Submitting..." : "Submit Acknowledgement"}
            </Button>
          )}

        </div>
      </div>

      {/* Document Content */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8" ref={documentRef}>
          {/* Header */}
          <div className="text-center space-y-4 border-b pb-6 mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              MATERIAL REQUEST ACKNOWLEDGEMENT
            </h1>
            <h2 className="text-lg font-semibold text-foreground">
              {materialRequest.businessUnit.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              Acknowledgement of Receipt for Material Request
            </p>
          </div>

          {/* Document & Requestee Information - Single Row */}
          <div className="bg-muted/50 border rounded-lg p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Document No</div>
                <div className="font-semibold text-base">{materialRequest.docNo}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date Prepared</div>
                <div className="font-medium">{format(new Date(materialRequest.datePrepared), "MMM dd, yyyy")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Type</div>
                <div className="font-medium">{materialRequest.type}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</div>
                <div><Badge variant="secondary">{materialRequest.status}</Badge></div>
              </div>
            </div>
            
            <hr className="my-4 border-border/50" />
            
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Requestee Information</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Name</div>
                <div className="font-medium">{materialRequest.requestedBy.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Employee ID</div>
                <div className="font-medium">{materialRequest.requestedBy.employeeId}</div>
              </div>
              {materialRequest.chargeTo && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Charged to:</div>
                  <div className="font-medium">{materialRequest.chargeTo}</div>
                </div>
              )}
            </div>
          </div>

          {/* Items Received */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Items Received</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px]">UOM</TableHead>
                  <TableHead className="w-[100px] text-right">Quantity</TableHead>
                  <TableHead className="w-[120px] text-right">Unit Price</TableHead>
                  <TableHead className="w-[120px] text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialRequest.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.itemCode || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.description}</div>
                        {item.remarks && (
                          <div className="text-sm text-muted-foreground">{item.remarks}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {item.unitPrice ? `₱${item.unitPrice.toLocaleString()}` : "N/A"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.totalPrice ? `₱${item.totalPrice.toLocaleString()}` : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <hr className="my-6 border-border" />

          {/* Acknowledgement Statement */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Acknowledgement</h3>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm leading-relaxed">
                I hereby acknowledge that I have received all the items listed above in good condition 
                and in the quantities specified. I confirm that the materials received match the 
                description and specifications in the material request. By signing below, I accept 
                full responsibility for the received items.
              </p>
            </div>
          </div>

          {/* Signature Section */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Digital Signature:</h4>
              {!isAcknowledged ? (
                <div className="print:hidden">
                  <DigitalSignaturePad 
                    onSignatureChange={handleSignatureChange}
                    width={800}
                    height={200}
                  />
                </div>
              ) : (
                <div className="p-4">
                  {signature && (
                    <img 
                      src={signature} 
                      alt="Digital Signature" 
                      className="signature-image max-w-[400px] max-h-[200px] mx-auto block"
                    />
                  )}
                  <div className="text-center mt-2 print:block hidden">
                    <p className="text-sm text-muted-foreground">
                      Digitally signed on {acknowledgedAt ? format(acknowledgedAt, "PPP 'at' p") : format(new Date(), "PPP 'at' p")}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Show signature in print mode even if not acknowledged yet */}
              {signature && !isAcknowledged && (
                <div className="hidden print:block p-4">
                  <img 
                    src={signature} 
                    alt="Digital Signature" 
                    className="signature-image max-w-[400px] max-h-[200px] mx-auto block"
                  />
                  <div className="text-center mt-2">
                    <p className="text-sm text-muted-foreground">
                      Digital Signature
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
              <div>
                <p className="text-sm font-medium">
                  {materialRequest.requestedBy.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {materialRequest.requestedBy.employeeId} • Requestee
                </p>
              </div>
              
              <div className="space-y-2">
                <div>
                  <h4 className="font-semibold text-sm">Date & Time:</h4>
                  <div className="text-sm font-medium">
                    {format(new Date(), "PPP 'at' p")}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This document serves as official acknowledgement of receipt.
                </p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}