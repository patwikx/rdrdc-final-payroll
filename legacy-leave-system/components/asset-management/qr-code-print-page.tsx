"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Printer, 
  ArrowLeft,
  Loader2,
  Download
} from "lucide-react"
import { AssetWithDetails } from "@/lib/actions/asset-management-actions"
import { generateAssetQRCode } from "@/lib/actions/qr-code-actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface QRCodePrintPageProps {
  assets: AssetWithDetails[]
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
}

interface AssetQRData {
  asset: AssetWithDetails
  qrCode: string | null
  loading: boolean
}

export function QRCodePrintPage({ 
  assets, 
  businessUnit, 
  businessUnitId 
}: QRCodePrintPageProps) {
  const router = useRouter()
  const [assetQRData, setAssetQRData] = useState<AssetQRData[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Initialize asset QR data
  useEffect(() => {
    if (assets.length > 0) {
      const initialData = assets.map(asset => ({
        asset,
        qrCode: asset.barcodeValue || null,
        loading: !asset.barcodeValue
      }))
      setAssetQRData(initialData)
      
      // Generate missing QR codes
      generateMissingQRCodes(initialData)
    }
  }, [assets])

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
    const validAssets = assetQRData.filter(item => item.qrCode)
    
    if (validAssets.length === 0) {
      toast.error("No QR codes available to print")
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error("Unable to open print window. Please check your popup blocker.")
      return
    }

    const printContent = generatePrintHTML(validAssets)
    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Wait for images to load before printing
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 1000)
    
    toast.success("Print dialog opened")
  }

  const generatePrintHTML = (validAssets: AssetQRData[]) => {
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
              margin-bottom: 25px;
              border-bottom: 3px solid #000;
              padding-bottom: 12px;
            }
            
            .business-unit-name {
              font-size: 26px;
              font-weight: bold;
              color: #000;
              margin: 0 0 6px 0;
              letter-spacing: 1px;
            }
            
            .print-date {
              font-size: 13px;
              color: #666;
              margin: 0;
            }
            
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 12px;
              margin-top: 25px;
            }
            
            .qr-item {
              width: 1.5in;
              height: 1.5in;
              border: 1px solid #333;
              border-radius: 6px;
              padding: 8px;
              text-align: center;
              background: white;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
            }
            
            .qr-code {
              width: 0.9in;
              height: 0.9in;
              margin-bottom: 4px;
              display: block;
            }
            
            .asset-info {
              text-align: center;
              line-height: 1.1;
            }
            
            .item-code {
              font-weight: bold;
              font-size: 9px;
              margin-bottom: 2px;
              color: #000;
              font-family: 'Courier New', monospace;
            }
            
            .category {
              color: #555;
              font-size: 7px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            
            @media print {
              body { 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .qr-item { 
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="page-header">
            <h1 class="business-unit-name">${businessUnit.name}</h1>
            <p class="print-date">Asset QR Codes - ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="qr-grid">
            ${validAssets.map(item => `
              <div class="qr-item">
                <img src="${item.qrCode}" alt="QR Code" class="qr-code" />
                <div class="asset-info">
                  <div class="item-code">${item.asset.itemCode}</div>
                  <div class="category">${item.asset.category.name}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `
  }

  const handleBack = () => {
    router.push(`/${businessUnitId}/asset-management/asset-printing`)
  }

  const handleDownload = () => {
    // For now, use the same print functionality
    // In a production environment, you might want to use jsPDF or similar
    handlePrint()
  }

  const readyToPrint = assetQRData.every(item => !item.loading)
  const validQRCount = assetQRData.filter(item => item.qrCode).length

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Selection
              </Button>
              <div className="text-sm text-muted-foreground">
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating QR codes...
                  </div>
                ) : (
                  `${validQRCount} of ${assets.length} QR codes ready`
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleDownload}
                disabled={!readyToPrint || validQRCount === 0}
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                onClick={handlePrint}
                disabled={!readyToPrint || validQRCount === 0}
                size="lg"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print QR Codes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Print Content - Legal Paper Size Simulation */}
      <div className="print-page-container">
        <div className="print-page">
          {/* Header */}
          <div className="page-header">
            <h1 className="business-unit-name">{businessUnit.name}</h1>
            <p className="print-date">Asset QR Codes - {new Date().toLocaleDateString()}</p>
          </div>

          {/* QR Grid */}
          <div className="qr-grid">
            {assetQRData.map((item, index) => (
              <div key={item.asset.id} className="qr-item">
                {item.loading ? (
                  <div className="qr-placeholder">
                    <Loader2 className="loading-spinner" />
                  </div>
                ) : item.qrCode ? (
                  <img 
                    src={item.qrCode} 
                    alt="QR Code" 
                    className="qr-code"
                  />
                ) : (
                  <div className="qr-placeholder">
                    <span className="no-qr-text">No QR</span>
                  </div>
                )}
                
                <div className="asset-info">
                  <div className="item-code">{item.asset.itemCode}</div>
                  <div className="category">{item.asset.category.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .print-page-container {
          display: flex;
          justify-content: center;
          padding: 20px;
          min-height: calc(100vh - 80px);
        }

        .print-page {
          width: 8.5in;
          min-height: 14in;
          background: white;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          padding: 0.5in;
          margin: 0 auto;
        }

        .page-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #000;
          padding-bottom: 15px;
        }

        .business-unit-name {
          font-size: 28px;
          font-weight: bold;
          color: #000;
          margin: 0 0 8px 0;
          letter-spacing: 1px;
        }

        .print-date {
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .qr-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-top: 25px;
        }

        .qr-item {
          width: 1.5in;
          height: 1.5in;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 8px;
          text-align: center;
          background: white;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }

        .qr-code {
          width: 0.9in;
          height: 0.9in;
          margin-bottom: 4px;
          border: 1px solid #eee;
          border-radius: 2px;
        }

        .qr-placeholder {
          width: 0.9in;
          height: 0.9in;
          margin-bottom: 4px;
          border: 2px dashed #ccc;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f9f9f9;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          color: #666;
          animation: spin 1s linear infinite;
        }

        .no-qr-text {
          font-size: 12px;
          color: #999;
        }

        .asset-info {
          text-align: center;
        }

        .item-code {
          font-weight: bold;
          font-size: 9px;
          margin-bottom: 2px;
          color: #000;
          font-family: 'Courier New', monospace;
          line-height: 1.1;
        }

        .category {
          color: #555;
          font-size: 7px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          line-height: 1.1;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media print {
          .print-page-container {
            padding: 0;
          }

          .print-page {
            width: 100%;
            min-height: 100vh;
            box-shadow: none;
            margin: 0;
            padding: 0.5in;
          }

          .qr-grid {
            gap: 12px;
          }

          .qr-item {
            width: 1.5in;
            height: 1.5in;
            border: 1px solid #333;
            break-inside: avoid;
            padding: 8px;
          }

          .qr-code {
            width: 0.9in;
            height: 0.9in;
          }

          .qr-placeholder {
            width: 0.9in;
            height: 0.9in;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        @media screen and (max-width: 1024px) {
          .print-page {
            width: 95%;
            transform: scale(0.8);
            transform-origin: top center;
          }
        }

        @media screen and (max-width: 768px) {
          .print-page {
            transform: scale(0.6);
          }

          .qr-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  )
}