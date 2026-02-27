"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  QrCode, 
  Camera, 
  X, 
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { toast } from "sonner"
import jsQR from "jsqr"

interface QRCodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessUnitId: string
}

export function QRCodeScanner({ open, onOpenChange, businessUnitId }: QRCodeScannerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [scanResult, setScanResult] = useState<string | null>(null)

  useEffect(() => {
    if (open && !isScanning) {
      startCamera()
    } else if (!open && stream) {
      stopCamera()
    }

    return () => {
      if (stream) {
        stopCamera()
      }
    }
  }, [open])

  const startCamera = async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })
      
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
        setIsScanning(true)
        
        // Start scanning for QR codes
        scanForQRCode()
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setError('Unable to access camera. Please ensure camera permissions are granted.')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsScanning(false)
  }

  const scanForQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanForQRCode)
      return
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get image data for QR code detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    
    // Use jsQR to detect QR codes
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    })

    if (code) {
      handleQRCodeDetected(code.data)
      return
    }
    
    // Continue scanning
    if (isScanning) {
      requestAnimationFrame(scanForQRCode)
    }
  }

  const handleQRCodeDetected = (data: string) => {
    setScanResult(data)
    setIsScanning(false)
    stopCamera()

    // Check if it's a URL to an asset page
    try {
      const url = new URL(data)
      const pathParts = url.pathname.split('/')
      
      // Expected format: /public/assets/{assetId} (new format)
      if (pathParts.includes('public') && pathParts.includes('assets')) {
        const assetId = pathParts[pathParts.length - 1]
        if (assetId && assetId !== 'assets') {
          toast.success("Asset QR Code detected! Redirecting...")
          // Redirect to the public URL (no login required)
          window.open(data, '_blank')
          onOpenChange(false)
          return
        }
      }
      
      // Legacy format: /{businessUnitId}/asset-management/assets/{assetId}
      if (pathParts.includes('asset-management') && pathParts.includes('assets')) {
        const assetId = pathParts[pathParts.length - 1]
        if (assetId && assetId !== 'assets') {
          toast.success("Asset QR Code detected! Redirecting...")
          router.push(data)
          onOpenChange(false)
          return
        }
      }
    } catch (error) {
      // Not a valid URL, might be legacy JSON format
      try {
        const jsonData = JSON.parse(data)
        if (jsonData.assetId && jsonData.businessUnitId) {
          const assetUrl = `/public/assets/${jsonData.assetId}`
          toast.success("Asset QR Code detected! Redirecting...")
          window.open(assetUrl, '_blank')
          onOpenChange(false)
          return
        }
      } catch (jsonError) {
        // Not JSON either
      }
    }

    // If we get here, it's not a recognized asset QR code
    toast.error("This QR code is not recognized as an asset QR code")
    setError("Unrecognized QR code format")
  }

  const handleManualInput = () => {
    // For demo purposes, simulate a scanned QR code URL
    const mockAssetId = "demo-asset-id"
    const mockUrl = `/public/assets/${mockAssetId}`
    
    handleQRCodeDetected(`${window.location.origin}${mockUrl}`)
  }

  const handleClose = () => {
    stopCamera()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan Asset QR Code
          </DialogTitle>
          <DialogDescription>
            Point your camera at an asset QR code to scan it
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : scanResult ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                QR Code detected! Redirecting to asset page...
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full h-64 bg-black rounded-lg object-cover"
                    playsInline
                    muted
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                  
                  {isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg flex items-center justify-center">
                        <div className="text-white text-sm text-center">
                          <QrCode className="h-8 w-8 mx-auto mb-2" />
                          Position QR code here
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            {!isScanning && !error && (
              <Button onClick={startCamera} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
            )}
            
            {isScanning && (
              <Button onClick={stopCamera} variant="outline" className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Stop Scanning
              </Button>
            )}
            
            <Button onClick={handleManualInput} variant="outline">
              Demo Scan
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            <p>Make sure the QR code is well-lit and clearly visible.</p>
            <p>The scanner will automatically detect and process the code.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}