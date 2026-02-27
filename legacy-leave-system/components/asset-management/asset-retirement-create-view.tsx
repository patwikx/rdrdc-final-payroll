"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
// Removed Card components - using cleaner layout without cards
// Removed Input - not used in this component
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  CalendarIcon, 
  Archive, 
  ArrowLeft, 
  AlertTriangle,
  Package
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  retireAssets, 

  RetireAssetsData,
  getAvailableReplacementAssets,
  RetirableAssetsResponse
} from "@/lib/actions/asset-retirement-actions"
import { RETIREMENT_REASONS, RETIREMENT_METHODS, ASSET_CONDITIONS } from "@/lib/constants/asset-retirement-constants"

interface AssetRetirementCreateViewProps {
  retirableAssetsData: RetirableAssetsResponse
  businessUnitId: string
  preSelectedAssetIds: string[]
}

export function AssetRetirementCreateView({
  retirableAssetsData,
  businessUnitId,
  preSelectedAssetIds
}: AssetRetirementCreateViewProps) {
  const router = useRouter()
  
  // Form state
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set(preSelectedAssetIds))
  const [retirementDate, setRetirementDate] = useState<Date>(new Date())
  const [reason, setReason] = useState<string>("")
  const [retirementMethod, setRetirementMethod] = useState("")
  const [condition, setCondition] = useState("")
  const [notes, setNotes] = useState("")
  const [replacementAssetId, setReplacementAssetId] = useState("")
  const [disposalPlanned, setDisposalPlanned] = useState(false)
  const [disposalDate, setDisposalDate] = useState<Date | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  
  // Replacement assets
  const [replacementAssets, setReplacementAssets] = useState<any[]>([])
  const [isLoadingReplacements, setIsLoadingReplacements] = useState(false)

  // Load replacement assets
  useEffect(() => {
    loadReplacementAssets()
  }, [businessUnitId])

  const loadReplacementAssets = async () => {
    setIsLoadingReplacements(true)
    try {
      const assets = await getAvailableReplacementAssets(businessUnitId)
      setReplacementAssets(assets)
    } catch (error) {
      console.error("Error loading replacement assets:", error)
      toast.error("Failed to load replacement assets")
    } finally {
      setIsLoadingReplacements(false)
    }
  }

  const handleAssetToggle = (assetId: string) => {
    const newSelected = new Set(selectedAssets)
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId)
    } else {
      newSelected.add(assetId)
    }
    setSelectedAssets(newSelected)
  }

  const handleSubmit = async () => {
    if (selectedAssets.size === 0) {
      toast.error("Please select at least one asset to retire")
      return
    }

    if (!reason) {
      toast.error("Please select a retirement reason")
      return
    }

    if (disposalPlanned && !disposalDate) {
      toast.error("Please select a disposal date when disposal is planned")
      return
    }

    setIsLoading(true)
    try {
      const retirementData: RetireAssetsData = {
        assetIds: Array.from(selectedAssets),
        retirementDate,
        reason: reason as any,
        retirementMethod: retirementMethod || undefined,
        condition: condition || undefined,
        notes: notes || undefined,
        replacementAssetId: replacementAssetId || undefined,
        disposalPlanned,
        disposalDate: disposalPlanned ? disposalDate : undefined,
        businessUnitId
      }

      const result = await retireAssets(retirementData)

      if (result.error) {
        toast.error(result.error)
      } else if ('success' in result) {
        toast.success(result.success)
        router.push(`/${businessUnitId}/asset-management/retirements`)
      }
    } catch (error) {
      console.error("Error retiring assets:", error)
      toast.error("Failed to retire assets")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedAssetsList = retirableAssetsData.assets.filter(asset => 
    selectedAssets.has(asset.id)
  )

  const deployedAssets = selectedAssetsList.filter(asset => asset.status === 'DEPLOYED')
  const hasDeployedAssets = deployedAssets.length > 0

  const totalBookValue = selectedAssetsList.reduce((sum, asset) => 
    sum + (asset.currentBookValue || 0), 0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Retire Assets</h1>
            <p className="text-sm text-muted-foreground">
              Remove assets from active service and update their status
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || selectedAssets.size === 0}
          >
            {isLoading ? "Retiring..." : `Retire ${selectedAssets.size} Asset${selectedAssets.size > 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Asset Selection */}
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Select Assets to Retire
            </h2>
          </div>
          
          <div className="space-y-4">
            <div className="max-h-[600px] overflow-auto border rounded-md">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Book Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retirableAssetsData.assets.map((asset) => (
                    <TableRow 
                      key={asset.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedAssets.has(asset.id) ? 'bg-muted/30' : ''}`}
                      onClick={() => handleAssetToggle(asset.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedAssets.has(asset.id)}
                          onCheckedChange={() => handleAssetToggle(asset.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{asset.itemCode}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {asset.description}
                          </div>
                          {asset.brand && (
                            <div className="text-xs text-muted-foreground">
                              {asset.brand}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {asset.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={asset.status === 'DEPLOYED' ? 'secondary' : 'default'}>
                          {asset.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {asset.purchaseDate ? 
                            format(new Date(asset.purchaseDate), 'MMM dd, yyyy') : 
                            <span className="text-muted-foreground">N/A</span>
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {asset.assignedEmployee ? 
                            asset.assignedEmployee.name : 
                            <span className="text-muted-foreground">Unassigned</span>
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {asset.currentBookValue ? 
                            `₱${asset.currentBookValue.toLocaleString()}` : 
                            'N/A'
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {selectedAssets.size > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedAssets.size} asset{selectedAssets.size > 1 ? 's' : ''} selected
                  </span>
                  <span className="text-sm font-medium">
                    Total Book Value: ₱{totalBookValue.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Retirement Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Retirement Details
            </h2>
          </div>
          
          <div className="space-y-4">
            {/* Warning for deployed assets */}
            {hasDeployedAssets && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                      Deployed Assets Selected
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      {deployedAssets.length} of the selected assets are currently deployed. 
                      Please ensure they are returned before retirement.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Retirement Date */}
            <div className="space-y-2">
              <Label>Retirement Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !retirementDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {retirementDate ? format(retirementDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={retirementDate}
                    onSelect={(date) => date && setRetirementDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Retirement Reason */}
            <div className="space-y-2">
              <Label>Retirement Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select retirement reason" />
                </SelectTrigger>
                <SelectContent>
                  {RETIREMENT_REASONS.map((reasonOption) => (
                    <SelectItem key={reasonOption.value} value={reasonOption.value}>
                      {reasonOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Retirement Method */}
            <div className="space-y-2">
              <Label>Retirement Method</Label>
              <Select value={retirementMethod} onValueChange={setRetirementMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {RETIREMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset Condition */}
            <div className="space-y-2">
              <Label>Asset Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select condition (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CONDITIONS.map((conditionOption) => (
                    <SelectItem key={conditionOption.value} value={conditionOption.value}>
                      {conditionOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Replacement Asset */}
            <div className="space-y-2">
              <Label>Replacement Asset</Label>
              <Select value={replacementAssetId} onValueChange={setReplacementAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select replacement (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {replacementAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.itemCode} - {asset.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Disposal Planning */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="disposal-planned"
                  checked={disposalPlanned}
                  onCheckedChange={(checked) => setDisposalPlanned(checked === true)}
                />
                <Label htmlFor="disposal-planned">Plan disposal after retirement</Label>
              </div>

              {disposalPlanned && (
                <div className="space-y-2">
                  <Label>Planned Disposal Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !disposalDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {disposalDate ? format(disposalDate, "PPP") : "Select disposal date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={disposalDate}
                        onSelect={setDisposalDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes about the retirement..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>
      </div>


    </div>
  )
}