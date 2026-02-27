"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { QrCode } from "lucide-react"
import { toast } from "sonner"
import { generateAssetQRCode } from "@/lib/actions/qr-code-actions"
import { QRCodeDisplay } from "./qr-code-display"

interface GenerateQRCodeButtonProps {
  assetId: string
  assetData: {
    itemCode: string
    description: string
    serialNumber?: string
  }
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
  className?: string
}

export function GenerateQRCodeButton({ 
  assetId, 
  assetData, 
  variant = "outline", 
  size = "sm",
  className
}: GenerateQRCodeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [qrCodeData, setQRCodeData] = useState<string | null>(null)

  const handleGenerateQR = async () => {
    setIsLoading(true)
    try {
      const result = await generateAssetQRCode(assetId)
      
      if (result.error) {
        toast.error(result.error)
      } else if (result.qrCode) {
        setQRCodeData(result.qrCode)
        setShowQRCode(true)
        toast.success("QR code generated successfully")
      }
    } catch (error) {
      toast.error("Failed to generate QR code")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleGenerateQR}
        disabled={isLoading}
        className={`flex items-center gap-2 ${className || ""}`}
      >
        <QrCode className="h-4 w-4" />
        {isLoading ? "..." : "View"}
      </Button>

      {qrCodeData && (
        <QRCodeDisplay
          open={showQRCode}
          onOpenChange={setShowQRCode}
          qrCodeDataURL={qrCodeData}
          assetData={assetData}
        />
      )}
    </>
  )
}