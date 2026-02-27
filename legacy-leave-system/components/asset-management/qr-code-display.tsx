"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  QrCode, 
  Download, 
  Printer, 
  Copy, 
  CheckCircle 
} from "lucide-react"
import { toast } from "sonner"

interface QRCodeDisplayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCodeDataURL: string
  assetData: {
    itemCode: string
    description: string
    serialNumber?: string
  }
}

export function QRCodeDisplay({ 
  open, 
  onOpenChange, 
  qrCodeDataURL, 
  assetData 
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleDownloadQR = () => {
    try {
      const link = document.createElement('a')
      link.href = qrCodeDataURL
      link.download = `${assetData.itemCode}-qrcode.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("QR code downloaded successfully")
    } catch (error) {
      toast.error("Failed to download QR code")
    }
  }

  const handlePrintQR = () => {
    try {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Asset QR Code - ${assetData.itemCode}</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  text-align: center;
                  padding: 20px;
                  margin: 0;
                }
                .qr-container {
                  display: inline-block;
                  border: 2px solid #000;
                  padding: 20px;
                  margin: 20px;
                }
                .asset-info {
                  margin-top: 15px;
                  font-size: 14px;
                }
                .item-code {
                  font-weight: bold;
                  font-size: 16px;
                  margin-bottom: 5px;
                }
                img {
                  display: block;
                  margin: 0 auto;
                }
              </style>
            </head>
            <body>
              <div class="qr-container">
                <img src="${qrCodeDataURL}" alt="QR Code" />
                <div class="asset-info">
                  <div class="item-code">${assetData.itemCode}</div>
                  <div>${assetData.description}</div>
                  ${assetData.serialNumber ? `<div>S/N: ${assetData.serialNumber}</div>` : ''}
                </div>
              </div>
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
        toast.success("QR code sent to printer")
      }
    } catch (error) {
      toast.error("Failed to print QR code")
    }
  }

  const handleCopyAssetCode = async () => {
    try {
      await navigator.clipboard.writeText(assetData.itemCode)
      setCopied(true)
      toast.success("Asset code copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy asset code")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Asset QR Code Generated
          </DialogTitle>
          <DialogDescription>
            QR code has been automatically generated for your new asset
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Code Display */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <img 
                    src={qrCodeDataURL} 
                    alt="Asset QR Code" 
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {assetData.itemCode}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyAssetCode}
                      className="h-6 w-6 p-0"
                    >
                      {copied ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {assetData.description}
                  </p>
                  {assetData.serialNumber && (
                    <p className="text-xs text-muted-foreground">
                      Serial: {assetData.serialNumber}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              onClick={handleDownloadQR}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button 
              variant="outline" 
              onClick={handlePrintQR}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>This QR code contains the asset information and can be scanned for quick access.</p>
            <p>You can also generate QR codes later from the asset details page.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}