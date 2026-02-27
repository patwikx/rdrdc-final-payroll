"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Calendar, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { getAssetsNeedingDepreciation, AssetNeedingDepreciation } from "@/lib/actions/depreciation-notification-actions"

interface DepreciationNotificationDialogProps {
  businessUnitId: string
  initialCount: number
  userRole: string
}

export function DepreciationNotificationDialog({ 
  businessUnitId, 
  initialCount,
  userRole 
}: DepreciationNotificationDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [assets, setAssets] = useState<AssetNeedingDepreciation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // Check if we should show the notification
  useEffect(() => {
    // Only show to users who can manage assets
    if (!["ADMIN", "MANAGER", "ACCTG"].includes(userRole)) {
      return
    }

    // Check if we've shown the notification in the last 5 minutes
    const now = new Date().getTime()
    const lastShownTime = localStorage.getItem(`depreciation-notification-time-${businessUnitId}`)
    const fiveMinutesAgo = now - (5 * 60 * 1000) // 5 minutes in milliseconds
    
    // Only show if there are assets needing depreciation and it's been more than 5 minutes since last shown
    if (initialCount > 0 && (!lastShownTime || parseInt(lastShownTime) < fiveMinutesAgo)) {
      setIsOpen(true)
    }
  }, [initialCount, businessUnitId, userRole])

  // Set up interval to check and show notification every 5 minutes
  useEffect(() => {
    if (!["ADMIN", "MANAGER", "ACCTG"].includes(userRole) || initialCount === 0) {
      return
    }

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const lastShownTime = localStorage.getItem(`depreciation-notification-time-${businessUnitId}`)
      const fiveMinutesAgo = now - (5 * 60 * 1000)
      
      // Show notification if it's been more than 5 minutes since last shown
      if (!lastShownTime || parseInt(lastShownTime) < fiveMinutesAgo) {
        setIsOpen(true)
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    return () => clearInterval(interval)
  }, [initialCount, businessUnitId, userRole])

  // Load assets when dialog opens
  useEffect(() => {
    if (isOpen && assets.length === 0) {
      loadAssets()
    }
  }, [isOpen])

  const loadAssets = async () => {
    setIsLoading(true)
    try {
      const assetsData = await getAssetsNeedingDepreciation(businessUnitId)
      setAssets(assetsData)
    } catch (error) {
      console.error("Error loading assets:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewDepreciation = () => {
    setIsOpen(false)
    // Mark the current time as last shown
    const now = new Date().getTime()
    localStorage.setItem(`depreciation-notification-time-${businessUnitId}`, now.toString())
    router.push(`/${businessUnitId}/asset-management/depreciation/calculate`)
  }

  const handleDismiss = () => {
    setIsOpen(false)
    // Mark the current time as last shown
    const now = new Date().getTime()
    localStorage.setItem(`depreciation-notification-time-${businessUnitId}`, now.toString())
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const getOverdueDays = (date: Date) => {
    const today = new Date()
    const diffTime = today.getTime() - date.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (initialCount === 0) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/20">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">Depreciation Required</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {initialCount} asset{initialCount !== 1 ? 's' : ''} need{initialCount === 1 ? 's' : ''} depreciation processing
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading assets...</div>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[400px] text-xs">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow className="text-xs">
                    <TableHead className="p-2">Asset</TableHead>
                    <TableHead className="p-2 w-[100px]">Category</TableHead>
                    <TableHead className="p-2 w-[90px]">Due Date</TableHead>
                    <TableHead className="text-right p-2 w-[90px]">Monthly Dep.</TableHead>
                    <TableHead className="text-right p-2 w-[90px]">Book Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => {
                    const overdueDays = getOverdueDays(asset.nextDepreciationDate)
                    
                    return (
                      <TableRow key={asset.id} className="text-xs">
                        <TableCell className="p-2">
                          <div>
                            <div className="font-medium">{asset.itemCode}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                              {asset.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {asset.category.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px]">
                              {format(asset.nextDepreciationDate, "MMM dd, yy")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right p-2">
                          <span className="font-medium">
                            {formatCurrency(asset.monthlyDepreciation)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right p-2">
                          <span className="font-medium">
                            {formatCurrency(asset.currentBookValue)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>
              Total: {assets.length} asset{assets.length !== 1 ? 's' : ''} requiring depreciation
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDismiss}>
              Dismiss
            </Button>
            <Button onClick={handleViewDepreciation} className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Process Depreciation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}