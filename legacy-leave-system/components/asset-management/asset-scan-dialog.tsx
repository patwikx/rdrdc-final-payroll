"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  QrCode, 
  Camera, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { 
  scanAsset,
  markAssetNotFound,
  reportDiscrepancy
} from "@/lib/actions/inventory-verification-actions"

interface AssetScanDialogProps {
  asset: any
  verificationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AssetScanDialog({
  asset,
  verificationId,
  open,
  onOpenChange,
  onSuccess
}: AssetScanDialogProps) {
  const [scannedCode, setScannedCode] = useState("")
  const [notes, setNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [scanResult, setScanResult] = useState<'verified' | 'discrepancy' | null>(null)

  const handleScan = async () => {
    if (!scannedCode.trim()) {
      toast.error("Please enter or scan an asset code")
      return
    }

    setIsLoading(true)
    try {
      const result = await scanAsset({
        verificationId,
        assetId: asset.id,
        scannedCode: scannedCode.trim(),
        notes: notes.trim() || undefined
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        // Determine scan result based on whether codes match
        const isMatch = scannedCode.trim().toLowerCase() === asset.assetTag.toLowerCase()
        setScanResult(isMatch ? 'verified' : 'discrepancy')
        
        if (isMatch) {
          toast.success("Asset verified successfully!")
          setTimeout(() => {
            onSuccess()
          }, 1500)
        } else {
          toast.warning("Asset code mismatch detected")
        }
      }
    } catch (error) {
      console.error("Error scanning asset:", error)
      toast.error("Failed to scan asset")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkNotFound = async () => {
    setIsLoading(true)
    try {
      const result = await markAssetNotFound({
        verificationId,
        assetId: asset.id,
        notes: notes.trim() || undefined
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Asset marked as not found")
        onSuccess()
      }
    } catch (error) {
      console.error("Error marking asset as not found:", error)
      toast.error("Failed to mark asset as not found")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReportDiscrepancy = async () => {
    setIsLoading(true)
    try {
      const result = await reportDiscrepancy({
        verificationId,
        assetId: asset.id,
        scannedCode: scannedCode.trim(),
        notes: notes.trim() || undefined
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Discrepancy reported")
        onSuccess()
      }
    } catch (error) {
      console.error("Error reporting discrepancy:", error)
      toast.error("Failed to report discrepancy")
    } finally {
      setIsLoading(false)
    }
  }

  const resetDialog = () => {
    setScannedCode("")
    setNotes("")
    setScanResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) resetDialog()
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan Asset: {asset.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Information */}
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Asset Tag:</span>
              <Badge variant="outline">{asset.assetTag}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Location:</span>
              <span className="text-sm">{asset.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Category:</span>
              <span className="text-sm">{asset.category?.name}</span>
            </div>
          </div>

          {scanResult === null && (
            <>
              {/* Scan Input */}
              <div className="space-y-2">
                <Label htmlFor="scanned-code">Scanned Asset Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="scanned-code"
                    value={scannedCode}
                    onChange={(e) => setScannedCode(e.target.value)}
                    placeholder="Scan or enter asset code..."
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon">
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any observations or notes..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleScan} 
                  disabled={isLoading || !scannedCode.trim()}
                  className="w-full"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify Asset
                </Button>
                
                <Button 
                  variant="destructive" 
                  onClick={handleMarkNotFound}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <XCircle className="mr-2 h-4 w-4" />
                  Mark as Not Found
                </Button>
              </div>
            </>
          )}

          {scanResult === 'verified' && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h3 className="font-semibold text-green-700">Asset Verified!</h3>
                <p className="text-sm text-muted-foreground">
                  Asset code matches and has been verified successfully.
                </p>
              </div>
            </div>
          )}

          {scanResult === 'discrepancy' && (
            <div className="space-y-4">
              <div className="text-center py-4 space-y-3">
                <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto" />
                <div>
                  <h3 className="font-semibold text-orange-700">Code Mismatch Detected</h3>
                  <p className="text-sm text-muted-foreground">
                    Expected: <code className="bg-muted px-1 rounded">{asset.assetTag}</code><br />
                    Scanned: <code className="bg-muted px-1 rounded">{scannedCode}</code>
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleReportDiscrepancy}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Report Discrepancy
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={resetDialog}
                  disabled={isLoading}
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}