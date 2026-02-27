"use client"

import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { QrCode, Download, Loader2 } from "lucide-react"
import { generateAssetQRCode, downloadAssetQRCode } from "@/lib/actions/qr-code-actions"
import { toast } from "sonner"

interface QRCodeCardProps {
  assetId: string
  assetData: {
    itemCode: string
    description: string
    serialNumber?: string
  }
  initialQRCode?: string | null
}

export function QRCodeCard({ assetId, assetData, initialQRCode }: QRCodeCardProps) {
  // Check if initialQRCode is a valid data URL or just an item code
  const isValidDataURL = (str: string | null | undefined): boolean => {
    if (!str) return false
    return str.startsWith('data:image/') || str.startsWith('data:image/png;base64,') || str.startsWith('data:image/jpeg;base64,')
  }
  
  const [qrCodeDataURL, setQRCodeDataURL] = useState<string | null>(() => {
    return isValidDataURL(initialQRCode) ? initialQRCode! : null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Auto-generate QR code if it doesn't exist or is invalid
  useEffect(() => {
    if (!qrCodeDataURL && !isLoading) {
      console.log("Auto-generating QR code for asset:", assetId)
      generateQRCode()
    }
  }, [qrCodeDataURL, isLoading, assetId])

  const generateQRCode = async () => {
    setIsLoading(true)
    try {
      const result = await generateAssetQRCode(assetId)
      
      if (result.error) {
        console.error("Error generating QR code:", result.error)
        toast.error("Failed to generate QR code")
      } else if (result.qrCode) {
        console.log("QR code generated successfully")
        setQRCodeDataURL(result.qrCode)
      }
    } catch (error) {
      console.error("Error generating QR code:", error)
      toast.error("Failed to generate QR code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const result = await downloadAssetQRCode(assetId)
      
      if (result.error) {
        toast.error(result.error)
      } else if (result.qrCode && result.fileName) {
        // Create download link
        const link = document.createElement('a')
        link.href = result.qrCode
        link.download = result.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success("QR code downloaded successfully")
      }
    } catch (error) {
      toast.error("Failed to download QR code")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">QR Code</h3>
        <QrCode className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="flex flex-col items-center justify-center min-h-[120px]">
        {isLoading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-12 w-12 text-gray-400 animate-spin" />
            <p className="text-xs text-muted-foreground">Generating...</p>
          </div>
        ) : qrCodeDataURL ? (
          <div className="flex flex-col items-center space-y-2">
            <img 
              src={qrCodeDataURL} 
              alt="Asset QR Code" 
              className="w-20 h-20 object-contain bg-white border rounded"
              onError={(e) => {
                console.error("QR code image failed to load:", qrCodeDataURL?.substring(0, 100))
                console.error("Image error event:", e)
                // Clear the invalid QR code and trigger regeneration
                setQRCodeDataURL(null)
                // Don't try to regenerate immediately to avoid infinite loops
                setTimeout(() => {
                  if (!isLoading) {
                    generateQRCode()
                  }
                }, 1000)
              }}
            />
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
                className="text-xs h-6 px-2"
                title="Download QR Code"
              >
                {isDownloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={generateQRCode}
                disabled={isLoading}
                className="text-xs h-6 px-2"
                title="Refresh QR Code"
              >
                <QrCode className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <QrCode className="h-12 w-12 text-gray-400" />
            <p className="text-xs text-muted-foreground">No QR Code</p>
          </div>
        )}
      </div>
    </div>
  )
}