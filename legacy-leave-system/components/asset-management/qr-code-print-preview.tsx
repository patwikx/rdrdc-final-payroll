"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  Printer, 
  Download, 
  Eye,
  Loader2
} from "lucide-react"
import { AssetWithDetails } from "@/lib/actions/asset-management-actions"
import { generateAssetQRCode } from "@/lib/actions/qr-code-actions"
import { toast } from "sonner"

interface QRCodePrintPreviewProps {
  assets: AssetWithDetails[]
  businessUnit: {
    id: string
    name: string
    code: string
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface AssetQRData {
  asset: AssetWithDetails
  qrCode: string | null
  loading: boolean
}

export function QRCodePrintPreview({ 
  assets, 
  businessUnit, 
  open, 
  onOpenChange 
}: QRCodePrintPreviewProps) {
  const [assetQRData, setAssetQRData] = useState<AssetQRData[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Initialize asset QR data
  useEffect(() => {
    if (open && assets.length > 0) {
      const initialData = assets.map(asset => ({
        asset,
        qrCode: asset.barcodeValue || null,
        loading: !asset.barcodeValue
      }))
      setAssetQRData(initialData)
      
      // Generate missing QR codes
      generateMissingQRCodes(initialData)
    }
  }, [open, assets])

  const generateMissingQRCodes = async (data: AssetQRData[]) => {
    const missingQRAssets = data.filter(item => !item.qrCode)
    
    if (missingQRAssets.length === 0) return

    setIsGenerating(true)
    
    for (const item of missingQRAssets) {
      try {
        const result = await generateAssetQRCode(item.asset.id)
        
        if (result.qrCode) {
          setAssetQRData(prev => prev.map(prevItem => 
            prevItem.asset.id === item.asset.id 
              ? { ...prevItem, qrCode: result.qrCode, loading: false }
              : prevItem
          ))
        } else {
          setAssetQRData(prev => prev.map(prevItem => 
            prevItem.asset.id === item.asset.id 
              ? { ...prevItem, loading: false }
              : prevItem
          ))
        }
      } catch (error) {
        console.error(`Error generating QR code for ${item.asset.itemCode}:`, error)
        setAssetQRData(prev => prev.map(prevItem => 
          prevItem.asset.id === item.asset.id 
            ? { ...prevItem, loading: false }
            : prevItem
        ))
      }
    }
    
    setIsGenerating(false)
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error("Unable to open print window. Please check your popup blocker.")
      return
    }

    const printContent = generatePrintHTML()
    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Wait for images to load before printing
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 1000)
    
    toast.success("Print dialog opened")
  }

  const handleDownloadPDF = () => {
    // For now, we'll use the print functionality
    // In a real implementation, you might want to use a library like jsPDF
    handlePrint()
  }

  const generatePrintHTML = () => {
    const validAssets = assetQRData.filter(item => item.qrCode)
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset QR Codes - ${businessUnit.name}</title>
          <style>
            @page {
              size: legal;
              margin: 0.5in;
            }
            
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: white;
            }
            
            .page-header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            
            .business-unit-name {
              font-size: 24px;
              font-weight: bold;
              color: #000;
              margin: 0;
            }
            
            .print-date {
              font-size: 12px;
              color: #666;
              margin: 5px 0 0 0;
            }
            
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin-top: 20px;
            }
            
            .qr-item {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 15px;
              text-align: center;
              background: white;
              page-break-inside: avoid;
            }
            
            .qr-code {
              width: 120px;
              height: 120px;
              margin: 0 auto 10px auto;
              display: block;
            }
            
            .asset-info {
              font-size: 11px;
              line-height: 1.3;
            }
            
            .item-code {
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 4px;
              color: #000;
            }
            
            .description {
              color: #333;
              margin-bottom: 4px;
              word-wrap: break-word;
            }
            
            .serial-number {
              color: #666;
              font-family: monospace;
              margin-bottom: 2px;
            }
            
            .category {
              color: #888;
              font-size: 10px;
            }
            
            @media print {
              body { -webkit-print-color-adjust: exact; }
              .qr-item { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="page-header">
            <h1 class="business-unit-name">${businessUnit.name}</h1>
            <p class="print-date">Asset QR Codes - Printed on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="qr-grid">
            ${validAssets.map(item => `
              <div class="qr-item">
                <img src="${item.qrCode}" alt="QR Code" class="qr-code" />
                <div class="asset-info">
                  <div class="item-code">${item.asset.itemCode}</div>
                  <div class="description">${item.asset.description}</div>
                  ${item.asset.serialNumber ? `<div class="serial-number">S/N: ${item.asset.serialNumber}</div>` : ''}
                  <div class="category">${item.asset.category.name}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `
  }

  const readyToPrint = assetQRData.every(item => !item.loading)
  const validQRCount = assetQRData.filter(item => item.qrCode).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print QR Codes Preview
          </DialogTitle>
          <DialogDescription>
            Preview and print QR codes for {assets.length} selected assets from {businessUnit.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isGenerating && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Generating missing QR codes...</span>
            </div>
          )}

          {/* Preview */}
          <div className="border rounded-lg p-4 bg-white" style={{ minHeight: '600px' }}>
            {/* Header Preview */}
            <div className="text-center mb-6 border-b-2 border-black pb-4">
              <h1 className="text-2xl font-bold text-black">{businessUnit.name}</h1>
              <p className="text-sm text-gray-600 mt-2">
                Asset QR Codes - Preview ({validQRCount} of {assets.length} ready)
              </p>
            </div>

            {/* QR Grid Preview */}
            <div className="grid grid-cols-4 gap-4">
              {assetQRData.map((item, index) => (
                <div key={item.asset.id} className="border border-gray-300 rounded-lg p-3 text-center bg-white">
                  {item.loading ? (
                    <div className="w-24 h-24 mx-auto mb-2 flex items-center justify-center border border-gray-200 rounded">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : item.qrCode ? (
                    <img 
                      src={item.qrCode} 
                      alt="QR Code" 
                      className="w-24 h-24 mx-auto mb-2 border border-gray-200 rounded"
                    />
                  ) : (
                    <div className="w-24 h-24 mx-auto mb-2 flex items-center justify-center border border-gray-200 rounded bg-gray-50">
                      <span className="text-xs text-gray-400">No QR</span>
                    </div>
                  )}
                  
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-black">{item.asset.itemCode}</div>
                    <div className="text-gray-700 leading-tight">{item.asset.description}</div>
                    {item.asset.serialNumber && (
                      <div className="text-gray-600 font-mono">S/N: {item.asset.serialNumber}</div>
                    )}
                    <div className="text-gray-500">{item.asset.category.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {validQRCount} of {assets.length} QR codes ready to print
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadPDF}
              disabled={!readyToPrint || validQRCount === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button 
              onClick={handlePrint}
              disabled={!readyToPrint || validQRCount === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}