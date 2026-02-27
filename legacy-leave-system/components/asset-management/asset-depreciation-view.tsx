"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Calculator,
  CheckSquare,
  X,
  Package,
  TrendingDown,
  DollarSign,
  Calendar,
  Clock,
  BarChart3,
  History,
  AlertTriangle,
  Settings
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { DepreciationDataResponse } from "@/lib/actions/asset-depreciation-actions"
import { AssetDepreciationCalculationDialog } from "./asset-depreciation-calculation-dialog"

import { ManualDepreciationDialog } from "./manual-depreciation-dialog"
import { toast } from "sonner"
import { format } from "date-fns"

interface AssetDepreciationViewProps {
  depreciationData: DepreciationDataResponse
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  currentFilters: {
    categoryId?: string
    search?: string
    page: number
    view: 'overview' | 'schedule' | 'history'
    period?: string
  }
}

export function AssetDepreciationView({ 
  depreciationData, 
  businessUnit,
  businessUnitId, 
  currentFilters 
}: AssetDepreciationViewProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "")
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [showCalculationDialog, setShowCalculationDialog] = useState(false)

  const [showManualDialog, setShowManualDialog] = useState(false)

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (currentFilters.categoryId) params.set('categoryId', currentFilters.categoryId)
    if (currentFilters.view) params.set('view', currentFilters.view)
    if (currentFilters.period) params.set('period', currentFilters.period)
    
    router.push(`/${businessUnitId}/asset-management/depreciation?${params.toString()}`)
  }

  const handleViewChange = (view: string) => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (currentFilters.categoryId) params.set('categoryId', currentFilters.categoryId)
    params.set('view', view)
    if (currentFilters.period) params.set('period', currentFilters.period)
    
    router.push(`/${businessUnitId}/asset-management/depreciation?${params.toString()}`)
  }

  const handleSelectAsset = (assetId: string, checked: boolean) => {
    const newSelected = new Set(selectedAssets)
    if (checked) {
      newSelected.add(assetId)
    } else {
      newSelected.delete(assetId)
    }
    setSelectedAssets(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedAssets.size === depreciationData.assets.length) {
      setSelectedAssets(new Set())
    } else {
      setSelectedAssets(new Set(depreciationData.assets.map(asset => asset.id)))
    }
  }

  const handleCalculateDepreciation = () => {
    if (selectedAssets.size === 0) {
      toast.error("Please select at least one asset to calculate depreciation")
      return
    }
    setShowCalculationDialog(true)
  }

  const selectedAssetsData = useMemo(() => {
    return depreciationData.assets.filter(asset => selectedAssets.has(asset.id))
  }, [depreciationData.assets, selectedAssets])

  const handleCalculationSuccess = () => {
    setSelectedAssets(new Set())
    setShowCalculationDialog(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Asset Depreciation</h1>
          <p className="text-sm text-muted-foreground">
            Manage and calculate asset depreciation across your organization
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {currentFilters.view !== 'history' && (
            <>
              <Badge variant="outline" className="font-mono">
                {selectedAssets.size} selected
              </Badge>
              <Button 
                variant="outline"
                onClick={() => router.push(`/${businessUnitId}/asset-management/depreciation/history`)}
              >
                <Clock className="h-4 w-4 mr-2" />
                View History
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push(`/${businessUnitId}/asset-management/depreciation/calculate`)}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Run Depreciation
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push(`/${businessUnitId}/asset-management/depreciation/schedules`)}
              >
                <Settings className="h-4 w-4 mr-2" />
                View Schedules
              </Button>
              {selectedAssets.size > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedAssets(new Set())}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button onClick={handleCalculateDepreciation}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Depreciation
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Assets</p>
                <p className="text-2xl font-bold">{depreciationData.summary.totalAssets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Current Book Value</p>
                <p className="text-2xl font-bold">₱{depreciationData.summary.totalCurrentBookValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Accumulated Depreciation</p>
                <p className="text-2xl font-bold">₱{depreciationData.summary.totalAccumulatedDepreciation.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Monthly Depreciation</p>
                <p className="text-2xl font-bold">₱{depreciationData.summary.totalMonthlyDepreciation.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">Fully Depreciated</p>
                <p className="text-2xl font-bold">{depreciationData.summary.fullyDepreciatedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">Needs Depreciation</p>
                <p className="text-2xl font-bold">{depreciationData.summary.assetsNeedingDepreciation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Depreciation Rate</p>
                <p className="text-2xl font-bold">
                  {depreciationData.summary.totalPurchaseValue > 0 
                    ? ((depreciationData.summary.totalAccumulatedDepreciation / depreciationData.summary.totalPurchaseValue) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={currentFilters.view} onValueChange={handleViewChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <DepreciationOverview 
            data={depreciationData}
            businessUnitId={businessUnitId}
            currentFilters={currentFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
          />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <DepreciationSchedule 
            data={depreciationData}
            businessUnitId={businessUnitId}
            currentFilters={currentFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
            selectedAssets={selectedAssets}
            handleSelectAsset={handleSelectAsset}
            handleSelectAll={handleSelectAll}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <DepreciationHistory 
            data={depreciationData}
            businessUnitId={businessUnitId}
            currentFilters={currentFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
          />
        </TabsContent>
      </Tabs>

      {/* Calculation Dialog */}
      {showCalculationDialog && (
        <AssetDepreciationCalculationDialog
          assets={selectedAssetsData}
          businessUnitId={businessUnitId}
          open={showCalculationDialog}
          onOpenChange={setShowCalculationDialog}
          onSuccess={handleCalculationSuccess}
        />
      )}

      {/* Manual Depreciation Dialog */}
      {showManualDialog && (
        <ManualDepreciationDialog
          businessUnitId={businessUnitId}
          categories={depreciationData.categories}
          open={showManualDialog}
          onOpenChange={setShowManualDialog}
          onSuccess={() => {
            setShowManualDialog(false)
            router.refresh()
          }}
        />
      )}


    </div>
  )
}

// Overview Component
function DepreciationOverview({ data, businessUnitId, currentFilters, searchTerm, setSearchTerm, handleSearch }: any) {
  const router = useRouter()

  // Helper function for currency formatting
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="space-y-4">
      {/* Method Breakdown Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Depreciation Methods</h3>
        
        {/* Desktop Table */}
        <div className="hidden md:block rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-left p-3 font-medium">Asset Count</th>
                  <th className="text-left p-3 font-medium">Total Book Value</th>
                  <th className="text-left p-3 font-medium">Avg Book Value</th>
                  <th className="text-left p-3 font-medium">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.byMethod.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <BarChart3 className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No depreciation methods found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.summary.byMethod.map((method: any) => {
                    const percentage = data.summary.totalAssets > 0 ? (method.count / data.summary.totalAssets) * 100 : 0
                    const avgBookValue = method.count > 0 ? method.totalBookValue / method.count : 0
                    
                    return (
                      <tr key={method.method} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{method.method.replace('_', ' ')}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-2xl font-bold">{method.count}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono">{formatCurrency(method.totalBookValue)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-sm">{formatCurrency(avgBookValue)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div 
                                className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {data.summary.byMethod.length === 0 ? (
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No depreciation methods found</p>
              </div>
            </div>
          ) : (
            data.summary.byMethod.map((method: any) => {
              const percentage = data.summary.totalAssets > 0 ? (method.count / data.summary.totalAssets) * 100 : 0
              const avgBookValue = method.count > 0 ? method.totalBookValue / method.count : 0
              
              return (
                <div key={method.method} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{method.method.replace('_', ' ')}</span>
                    </div>
                    <span className="text-2xl font-bold">{method.count}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Total Book Value</div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{formatCurrency(method.totalBookValue)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Avg Book Value</div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{formatCurrency(avgBookValue)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Percentage</span>
                      <span className="font-medium">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">By Category</h3>
        
        {/* Desktop Table */}
        <div className="hidden md:block rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Asset Count</th>
                  <th className="text-left p-3 font-medium">Total Book Value</th>
                  <th className="text-left p-3 font-medium">Total Depreciation</th>
                  <th className="text-left p-3 font-medium">Depreciation Rate</th>
                  <th className="text-left p-3 font-medium">Avg Asset Value</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.byCategory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No categories found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.summary.byCategory.map((category: any) => {
                    const totalValue = category.totalBookValue + category.totalDepreciation
                    const depreciationRate = totalValue > 0 ? (category.totalDepreciation / totalValue) * 100 : 0
                    const avgAssetValue = category.count > 0 ? category.totalBookValue / category.count : 0
                    
                    return (
                      <tr key={category.categoryId} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{category.categoryName}</div>
                              <div className="text-xs text-muted-foreground">{category.count} assets</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-lg font-bold">{category.count}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-green-500" />
                            <span className="font-mono">{formatCurrency(category.totalBookValue)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3 text-red-500" />
                            <span className="font-mono text-red-600">{formatCurrency(category.totalDepreciation)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <span className="text-sm font-medium">{depreciationRate.toFixed(1)}%</span>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div 
                                className={`rounded-full h-2 transition-all duration-300 ${
                                  depreciationRate >= 90 ? 'bg-red-500' : 
                                  depreciationRate >= 70 ? 'bg-orange-500' : 
                                  'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(depreciationRate, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-sm">{formatCurrency(avgAssetValue)}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {data.summary.byCategory.length === 0 ? (
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <Package className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No categories found</p>
              </div>
            </div>
          ) : (
            data.summary.byCategory.map((category: any) => {
              const totalValue = category.totalBookValue + category.totalDepreciation
              const depreciationRate = totalValue > 0 ? (category.totalDepreciation / totalValue) * 100 : 0
              const avgAssetValue = category.count > 0 ? category.totalBookValue / category.count : 0
              
              return (
                <div key={category.categoryId} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{category.categoryName}</div>
                        <div className="text-xs text-muted-foreground">{category.count} assets</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold">{category.count}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Total Book Value</div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-green-500" />
                        <span className="font-mono">{formatCurrency(category.totalBookValue)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Total Depreciation</div>
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-red-500" />
                        <span className="font-mono text-red-600">{formatCurrency(category.totalDepreciation)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Avg Asset Value</div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{formatCurrency(avgAssetValue)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Depreciation Rate</div>
                      <span className="font-medium">{depreciationRate.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`rounded-full h-2 transition-all duration-300 ${
                          depreciationRate >= 90 ? 'bg-red-500' : 
                          depreciationRate >= 70 ? 'bg-orange-500' : 
                          'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(depreciationRate, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// Schedule Component  
function DepreciationSchedule({ 
  data, 
  businessUnitId, 
  currentFilters, 
  searchTerm, 
  setSearchTerm, 
  handleSearch,
  selectedAssets,
  handleSelectAsset,
  handleSelectAll 
}: any) {
  const router = useRouter()

  // Helper function for currency formatting
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
          {searchTerm !== (currentFilters.search || "") && (
            <Button
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
              onClick={handleSearch}
            >
              Search
            </Button>
          )}
        </div>
        
        <Select 
          value={currentFilters.categoryId || "all"} 
          onValueChange={(value) => {
            const params = new URLSearchParams()
            if (searchTerm) params.set('search', searchTerm)
            if (value !== "all") params.set('categoryId', value)
            params.set('view', currentFilters.view)
            router.push(`/${businessUnitId}/asset-management/depreciation?${params.toString()}`)
          }}
        >
          <SelectTrigger className="w-[250px]">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Categories" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {data.categories.map((category: any) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name} ({category.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {data.assets.length} assets in depreciation schedule
        </div>
        {data.assets.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSelectAll}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            {selectedAssets.size === data.assets.length ? 'Deselect All' : 'Select All'}
          </Button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 w-[50px]">
                  <Checkbox
                    checked={data.assets.length > 0 && selectedAssets.size === data.assets.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all assets"
                  />
                </th>
                <th className="text-left p-3 font-medium">Item Code</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Purchase Price</th>
                <th className="text-left p-3 font-medium">Current Book Value</th>
                <th className="text-left p-3 font-medium">Accumulated Depreciation</th>
                <th className="text-left p-3 font-medium">Monthly Depreciation</th>
                <th className="text-left p-3 font-medium">Progress</th>
                <th className="text-left p-3 font-medium">Next Depreciation</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.assets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Calculator className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchTerm ? "No assets match your search criteria" : "No assets found for depreciation"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.assets.map((asset: any) => {
                  const needsDepreciation = asset.nextDepreciationDate && new Date(asset.nextDepreciationDate) <= new Date()
                  const depreciationProgress = asset.purchasePrice > 0 
                    ? (asset.accumulatedDepreciation / asset.purchasePrice) * 100 
                    : 0
                  
                  return (
                    <tr 
                      key={asset.id}
                      className={`border-b cursor-pointer hover:bg-muted/50 ${selectedAssets.has(asset.id) ? 'bg-muted/50' : ''}`}
                      onClick={() => handleSelectAsset(asset.id, !selectedAssets.has(asset.id))}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedAssets.has(asset.id)}
                          onCheckedChange={(checked) => handleSelectAsset(asset.id, checked === true)}
                          aria-label={`Select ${asset.itemCode}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-sm font-medium">{asset.itemCode}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{asset.description}</div>
                        {asset.brand && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {asset.brand}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {asset.category.name}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{formatCurrency(Number(asset.purchasePrice || 0))}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{formatCurrency(Number(asset.currentBookValue || 0))}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm">
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          <span className="font-mono text-red-600">{formatCurrency(Number(asset.accumulatedDepreciation || 0))}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{formatCurrency(Number(asset.monthlyDepreciation || 0))}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{depreciationProgress.toFixed(1)}%</div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className={`rounded-full h-2 transition-all duration-300 ${
                                depreciationProgress >= 100 ? 'bg-red-500' : 
                                depreciationProgress >= 75 ? 'bg-orange-500' : 
                                'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(depreciationProgress, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {asset.nextDepreciationDate ? (
                          <div className={`flex items-center gap-1 text-sm ${needsDepreciation ? 'text-orange-600' : ''}`}>
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(asset.nextDepreciationDate), 'MMM dd, yyyy')}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not scheduled</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {asset.isFullyDepreciated ? (
                            <Badge variant="destructive" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Fully Depreciated
                            </Badge>
                          ) : needsDepreciation ? (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Due
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {data.assets.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <Calculator className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm ? "No assets match your search criteria" : "No assets found for depreciation"}
              </p>
            </div>
          </div>
        ) : (
          data.assets.map((asset: any) => {
            const needsDepreciation = asset.nextDepreciationDate && new Date(asset.nextDepreciationDate) <= new Date()
            const depreciationProgress = asset.purchasePrice > 0 
              ? (asset.accumulatedDepreciation / asset.purchasePrice) * 100 
              : 0
            
            return (
              <div 
                key={asset.id}
                className={`border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 ${selectedAssets.has(asset.id) ? 'bg-muted/50 border-primary' : ''}`}
                onClick={() => handleSelectAsset(asset.id, !selectedAssets.has(asset.id))}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedAssets.has(asset.id)}
                      onCheckedChange={(checked) => handleSelectAsset(asset.id, checked === true)}
                      aria-label={`Select ${asset.itemCode}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <div className="font-mono text-sm font-medium">{asset.itemCode}</div>
                      <div className="font-medium text-sm">{asset.description}</div>
                      {asset.brand && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {asset.brand}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-xs">
                      {asset.category.name}
                    </Badge>
                    {asset.isFullyDepreciated ? (
                      <Badge variant="destructive" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Fully Depreciated
                      </Badge>
                    ) : needsDepreciation ? (
                      <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Due
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Purchase Price</div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">{formatCurrency(Number(asset.purchasePrice || 0))}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Current Book Value</div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">{formatCurrency(Number(asset.currentBookValue || 0))}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Accumulated Depreciation</div>
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="font-mono text-red-600">{formatCurrency(Number(asset.accumulatedDepreciation || 0))}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Monthly Depreciation</div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">{formatCurrency(Number(asset.monthlyDepreciation || 0))}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Depreciation Progress</span>
                    <span className="font-medium">{depreciationProgress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`rounded-full h-2 transition-all duration-300 ${
                        depreciationProgress >= 100 ? 'bg-red-500' : 
                        depreciationProgress >= 75 ? 'bg-orange-500' : 
                        'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(depreciationProgress, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {asset.nextDepreciationDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Next Depreciation</span>
                    <div className={`flex items-center gap-1 ${needsDepreciation ? 'text-orange-600' : ''}`}>
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(asset.nextDepreciationDate), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// History Component
function DepreciationHistory({ data, businessUnitId, currentFilters, searchTerm, setSearchTerm, handleSearch }: any) {
  const router = useRouter()

  // Helper function for currency formatting
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="space-y-4">
      {/* Period Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search depreciation history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
          {searchTerm !== (currentFilters.search || "") && (
            <Button
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6"
              onClick={handleSearch}
            >
              Search
            </Button>
          )}
        </div>
        
        <Select 
          value={currentFilters.period || "all"} 
          onValueChange={(value) => {
            const params = new URLSearchParams()
            if (searchTerm) params.set('search', searchTerm)
            params.set('view', 'history')
            if (value !== "all") params.set('period', value)
            router.push(`/${businessUnitId}/asset-management/depreciation?${params.toString()}`)
          }}
        >
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Periods" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            {/* Generate last 12 months */}
            {Array.from({ length: 12 }, (_, i) => {
              const date = new Date()
              date.setMonth(date.getMonth() - i)
              const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
              const label = format(date, 'MMMM yyyy')
              return (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {data.history.length} depreciation records
      </div>

      {/* Desktop History Table */}
      <div className="hidden md:block rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Asset</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Method</th>
                <th className="text-left p-3 font-medium">Book Value Start</th>
                <th className="text-left p-3 font-medium">Depreciation Amount</th>
                <th className="text-left p-3 font-medium">Book Value End</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <History className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchTerm ? "No history matches your search criteria" : "No depreciation history found"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.history.map((record: any) => (
                  <tr key={record.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {record.asset.itemCode}
                          </Badge>
                        </div>
                        <div className="font-medium text-sm">{record.asset.description}</div>
                        {record.asset.category && (
                          <div className="text-xs text-muted-foreground">
                            {record.asset.category.name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{format(new Date(record.depreciationDate), 'MMM dd, yyyy')}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Calculator className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{record.method.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm">{formatCurrency(record.bookValueStart)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-red-500" />
                        <span className="font-mono text-sm text-red-600">-{formatCurrency(record.depreciationAmount)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm">{formatCurrency(record.bookValueEnd)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {record.isAdjustment ? (
                        <Badge variant="secondary" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Adjustment
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Regular
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {record.notes ? (
                        <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={record.notes}>
                          {record.notes}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No notes</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile History Cards */}
      <div className="md:hidden space-y-4">
        {data.history.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <History className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm ? "No history matches your search criteria" : "No depreciation history found"}
              </p>
            </div>
          </div>
        ) : (
          data.history.map((record: any) => (
            <div key={record.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {record.asset.itemCode}
                    </Badge>
                    {record.isAdjustment ? (
                      <Badge variant="secondary" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Adjustment
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Regular
                      </Badge>
                    )}
                  </div>
                  <div className="font-medium text-sm">{record.asset.description}</div>
                  {record.asset.category && (
                    <div className="text-xs text-muted-foreground">
                      {record.asset.category.name}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{format(new Date(record.depreciationDate), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calculator className="h-3 w-3" />
                    <span>{record.method.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Book Value Start</div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{formatCurrency(record.bookValueStart)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Book Value End</div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{formatCurrency(record.bookValueEnd)}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-xs">Depreciation Amount</div>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="font-mono text-red-600 font-medium">-{formatCurrency(record.depreciationAmount)}</span>
                </div>
              </div>

              {record.notes && (
                <div>
                  <div className="text-muted-foreground text-xs">Notes</div>
                  <div className="text-sm">{record.notes}</div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Removed DepreciationAssetCard - now using table layout in schedule tab

// Removed DepreciationHistoryCard - now using table layout in history tab