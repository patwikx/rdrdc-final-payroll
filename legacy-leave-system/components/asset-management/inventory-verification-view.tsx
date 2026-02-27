"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  Plus,
  ClipboardList,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Play,
  CheckSquare,
  X,
  Package,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Calendar,
  Download,
  Trash2
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { InventoryVerificationsResponse } from "@/lib/actions/inventory-verification-actions"
import { format } from "date-fns"

interface InventoryVerificationViewProps {
  verificationsData: InventoryVerificationsResponse
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  currentFilters: {
    status?: string
    search?: string
    page: number
    view: 'overview' | 'active' | 'completed'
  }
}

export function InventoryVerificationView({ 
  verificationsData, 
  businessUnit,
  businessUnitId, 
  currentFilters 
}: InventoryVerificationViewProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || "")
  const [selectedVerifications, setSelectedVerifications] = useState<Set<string>>(new Set())

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (currentFilters.status) params.set('status', currentFilters.status)
    if (currentFilters.view) params.set('view', currentFilters.view)
    
    router.push(`/${businessUnitId}/asset-management/inventory?${params.toString()}`)
  }

  const handleViewChange = (view: string) => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (currentFilters.status) params.set('status', currentFilters.status)
    params.set('view', view)
    
    router.push(`/${businessUnitId}/asset-management/inventory?${params.toString()}`)
  }

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (status !== "all") params.set('status', status)
    if (currentFilters.view) params.set('view', currentFilters.view)
    
    router.push(`/${businessUnitId}/asset-management/inventory?${params.toString()}`)
  }

  const handleViewDetails = (verificationId: string) => {
    router.push(`/${businessUnitId}/asset-management/inventory/${verificationId}`)
  }

  const handleCreateNew = () => {
    router.push(`/${businessUnitId}/asset-management/inventory/create`)
  }

  const handleSelectVerification = (verificationId: string, checked: boolean) => {
    const newSelected = new Set(selectedVerifications)
    if (checked) {
      newSelected.add(verificationId)
    } else {
      newSelected.delete(verificationId)
    }
    setSelectedVerifications(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedVerifications.size === verificationsData.verifications.length) {
      setSelectedVerifications(new Set())
    } else {
      setSelectedVerifications(new Set(verificationsData.verifications.map(v => v.id)))
    }
  }

  const handleBulkExport = () => {
    // TODO: Implement bulk export functionality
    console.log('Exporting verifications:', Array.from(selectedVerifications))
  }

  const handleBulkDelete = () => {
    // TODO: Implement bulk delete functionality
    console.log('Deleting verifications:', Array.from(selectedVerifications))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Verification</h1>
          <p className="text-sm text-muted-foreground">
            Manage physical inventory counts and asset verification cycles
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {selectedVerifications.size} selected
          </Badge>
          {selectedVerifications.size > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedVerifications(new Set())}
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Verification
          </Button>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs value={currentFilters.view} onValueChange={handleViewChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="active">Active Verifications</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <VerificationOverview 
            data={verificationsData}
            businessUnitId={businessUnitId}
            currentFilters={currentFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
          />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <ActiveVerifications 
            data={verificationsData}
            businessUnitId={businessUnitId}
            currentFilters={currentFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
            handleStatusFilter={handleStatusFilter}
            selectedVerifications={selectedVerifications}
            handleSelectVerification={handleSelectVerification}
            handleSelectAll={handleSelectAll}
            handleViewDetails={handleViewDetails}
          />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <CompletedVerifications 
            data={verificationsData}
            businessUnitId={businessUnitId}
            currentFilters={currentFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearch={handleSearch}
            handleViewDetails={handleViewDetails}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Overview Component
function VerificationOverview({ data, businessUnitId, currentFilters, searchTerm, setSearchTerm, handleSearch }: any) {
  return (
    <div className="space-y-4">
      {/* Status Breakdown Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Verification Status</h3>
        
        {/* Desktop Table */}
        <div className="hidden md:block rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Count</th>
                  <th className="text-left p-3 font-medium">Total Assets</th>
                  <th className="text-left p-3 font-medium">Avg Progress</th>
                  <th className="text-left p-3 font-medium">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { status: 'PLANNED', count: data.summary.planned, icon: Clock, color: 'text-blue-500' },
                  { status: 'IN_PROGRESS', count: data.summary.inProgress, icon: Play, color: 'text-yellow-500' },
                  { status: 'COMPLETED', count: data.summary.completed, icon: CheckCircle, color: 'text-green-500' },
                  { status: 'CANCELLED', count: data.summary.cancelled, icon: XCircle, color: 'text-red-500' }
                ].map((item) => {
                  const percentage = data.summary.total > 0 ? (item.count / data.summary.total) * 100 : 0
                  const Icon = item.icon
                  
                  return (
                    <tr key={item.status} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${item.color}`} />
                          <span className="font-medium">{item.status.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-2xl font-bold">{item.count}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-medium">
                          {data.verifications
                            .filter((v: any) => v.status === item.status)
                            .reduce((sum: number, v: any) => sum + v.totalAssets, 0)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-medium">
                          {item.count > 0 
                            ? (data.verifications
                                .filter((v: any) => v.status === item.status)
                                .reduce((sum: number, v: any) => sum + v.progress, 0) / item.count).toFixed(1)
                            : 0}%
                        </span>
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
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {[
            { status: 'PLANNED', count: data.summary.planned, icon: Clock, color: 'text-blue-500' },
            { status: 'IN_PROGRESS', count: data.summary.inProgress, icon: Play, color: 'text-yellow-500' },
            { status: 'COMPLETED', count: data.summary.completed, icon: CheckCircle, color: 'text-green-500' },
            { status: 'CANCELLED', count: data.summary.cancelled, icon: XCircle, color: 'text-red-500' }
          ].map((item) => {
            const percentage = data.summary.total > 0 ? (item.count / data.summary.total) * 100 : 0
            const totalAssets = data.verifications
              .filter((v: any) => v.status === item.status)
              .reduce((sum: number, v: any) => sum + v.totalAssets, 0)
            const avgProgress = item.count > 0 
              ? (data.verifications
                  .filter((v: any) => v.status === item.status)
                  .reduce((sum: number, v: any) => sum + v.progress, 0) / item.count).toFixed(1)
              : 0
            const Icon = item.icon
            
            return (
              <div key={item.status} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${item.color}`} />
                    <span className="font-medium">{item.status.replace('_', ' ')}</span>
                  </div>
                  <span className="text-2xl font-bold">{item.count}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Total Assets</div>
                    <div className="font-medium">{totalAssets}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Avg Progress</div>
                    <div className="font-medium">{avgProgress}%</div>
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
          })}
        </div>
      </div>
    </div>
  )
}

// Active Verifications Component  
function ActiveVerifications({ 
  data, 
  businessUnitId, 
  currentFilters, 
  searchTerm, 
  setSearchTerm, 
  handleSearch,
  handleStatusFilter,
  selectedVerifications,
  handleSelectVerification,
  handleSelectAll,
  handleViewDetails
}: any) {
  const activeVerifications = data.verifications.filter((v: any) => 
    v.status === 'PLANNED' || v.status === 'IN_PROGRESS'
  )

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'PLANNED': return 'outline'
      case 'IN_PROGRESS': return 'secondary'
      case 'COMPLETED': return 'default'
      case 'CANCELLED': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'Planned'
      case 'IN_PROGRESS': return 'In Progress'
      case 'COMPLETED': return 'Completed'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search verifications..."
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
          value={currentFilters.status || "all"} 
          onValueChange={handleStatusFilter}
        >
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Statuses" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PLANNED">Planned</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {activeVerifications.length} active verifications
        </div>
        {activeVerifications.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSelectAll}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            {selectedVerifications.size === activeVerifications.length ? 'Deselect All' : 'Select All'}
          </Button>
        )}
      </div>

      {/* Desktop Verifications Table */}
      <div className="hidden md:block rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 w-[50px]">
                  <Checkbox
                    checked={activeVerifications.length > 0 && selectedVerifications.size === activeVerifications.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all verifications"
                  />
                </th>
                <th className="text-left p-3 font-medium">Verification Name</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Progress</th>
                <th className="text-left p-3 font-medium">Total Assets</th>
                <th className="text-left p-3 font-medium">Scanned</th>
                <th className="text-left p-3 font-medium">Verified</th>
                <th className="text-left p-3 font-medium">Discrepancies</th>
                <th className="text-left p-3 font-medium">Created By</th>
                <th className="text-left p-3 font-medium">Created Date</th>
              </tr>
            </thead>
            <tbody>
              {activeVerifications.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchTerm ? "No verifications match your search criteria" : "No active verifications found"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                activeVerifications.map((verification: any) => (
                  <tr 
                    key={verification.id}
                    className={`border-b cursor-pointer hover:bg-muted/50 ${selectedVerifications.has(verification.id) ? 'bg-muted/50' : ''}`}
                    onClick={() => handleViewDetails(verification.id)}
                  >
                    <td className="p-3">
                      <Checkbox
                        checked={selectedVerifications.has(verification.id)}
                        onCheckedChange={(checked) => handleSelectVerification(verification.id, checked === true)}
                        aria-label={`Select ${verification.verificationName}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{verification.verificationName}</div>
                        {verification.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {verification.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={getStatusVariant(verification.status)}>
                        {getStatusLabel(verification.status)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{verification.progress.toFixed(1)}%</div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                            style={{ width: `${Math.min(verification.progress, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-medium">{verification.totalAssets}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium">{verification.scannedAssets}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-green-600">{verification.verifiedAssets}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-red-600">{verification.discrepancies}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{verification.createdByEmployee.name}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{format(new Date(verification.createdAt), 'MMM dd, yyyy')}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Verification Cards */}
      <div className="md:hidden space-y-4">
        {activeVerifications.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm ? "No verifications match your search criteria" : "No active verifications found"}
              </p>
            </div>
          </div>
        ) : (
          activeVerifications.map((verification: any) => (
            <div 
              key={verification.id}
              className={`border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 ${selectedVerifications.has(verification.id) ? 'bg-muted/50 border-primary' : ''}`}
              onClick={() => handleViewDetails(verification.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedVerifications.has(verification.id)}
                    onCheckedChange={(checked) => handleSelectVerification(verification.id, checked === true)}
                    aria-label={`Select ${verification.verificationName}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div>
                    <div className="font-medium">{verification.verificationName}</div>
                    {verification.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {verification.description}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={getStatusVariant(verification.status)}>
                  {getStatusLabel(verification.status)}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{verification.progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                    style={{ width: `${Math.min(verification.progress, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Total Assets</div>
                  <div className="font-medium">{verification.totalAssets}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Scanned</div>
                  <div className="font-medium">{verification.scannedAssets}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Verified</div>
                  <div className="font-medium text-green-600">{verification.verifiedAssets}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Discrepancies</div>
                  <div className="font-medium text-red-600">{verification.discrepancies}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm pt-2 border-t">
                <div>
                  <div className="text-muted-foreground text-xs">Created By</div>
                  <div>{verification.createdByEmployee.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-xs">Created Date</div>
                  <div>{format(new Date(verification.createdAt), 'MMM dd, yyyy')}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Completed Verifications Component
function CompletedVerifications({ 
  data, 
  businessUnitId, 
  currentFilters, 
  searchTerm, 
  setSearchTerm, 
  handleSearch,
  handleViewDetails
}: any) {
  const completedVerifications = data.verifications.filter((v: any) => 
    v.status === 'COMPLETED' || v.status === 'CANCELLED'
  )

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'COMPLETED': return 'default'
      case 'CANCELLED': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Completed'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search completed verifications..."
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
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {completedVerifications.length} completed verifications
      </div>

      {/* Desktop Completed Verifications Table */}
      <div className="hidden md:block rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Verification Name</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Total Assets</th>
                <th className="text-left p-3 font-medium">Verified</th>
                <th className="text-left p-3 font-medium">Discrepancies</th>
                <th className="text-left p-3 font-medium">Completion Rate</th>
                <th className="text-left p-3 font-medium">Created By</th>
                <th className="text-left p-3 font-medium">Completed Date</th>
              </tr>
            </thead>
            <tbody>
              {completedVerifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchTerm ? "No completed verifications match your search" : "No completed verifications found"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                completedVerifications.map((verification: any) => {
                  const completionRate = verification.totalAssets > 0 
                    ? (verification.verifiedAssets / verification.totalAssets) * 100 
                    : 0
                  
                  return (
                    <tr 
                      key={verification.id}
                      className="border-b cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(verification.id)}
                    >
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{verification.verificationName}</div>
                          {verification.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {verification.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant={getStatusVariant(verification.status)}>
                          {getStatusLabel(verification.status)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="font-medium">{verification.totalAssets}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-green-600">{verification.verifiedAssets}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-red-600">{verification.discrepancies}</span>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{completionRate.toFixed(1)}%</div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className={`rounded-full h-2 transition-all duration-300 ${
                                completionRate >= 95 ? 'bg-green-500' : 
                                completionRate >= 80 ? 'bg-yellow-500' : 
                                'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(completionRate, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{verification.createdByEmployee.name}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{format(new Date(verification.updatedAt), 'MMM dd, yyyy')}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Completed Verification Cards */}
      <div className="md:hidden space-y-4">
        {completedVerifications.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm ? "No completed verifications match your search" : "No completed verifications found"}
              </p>
            </div>
          </div>
        ) : (
          completedVerifications.map((verification: any) => {
            const completionRate = verification.totalAssets > 0 
              ? (verification.verifiedAssets / verification.totalAssets) * 100 
              : 0
            
            return (
              <div 
                key={verification.id}
                className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50"
                onClick={() => handleViewDetails(verification.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{verification.verificationName}</div>
                    {verification.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {verification.description}
                      </div>
                    )}
                  </div>
                  <Badge variant={getStatusVariant(verification.status)}>
                    {getStatusLabel(verification.status)}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completion Rate</span>
                    <span className="font-medium">{completionRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`rounded-full h-2 transition-all duration-300 ${
                        completionRate >= 95 ? 'bg-green-500' : 
                        completionRate >= 80 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(completionRate, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Total Assets</div>
                    <div className="font-medium">{verification.totalAssets}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Verified</div>
                    <div className="font-medium text-green-600">{verification.verifiedAssets}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Discrepancies</div>
                    <div className="font-medium text-red-600">{verification.discrepancies}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Created By</div>
                    <div className="font-medium">{verification.createdByEmployee.name}</div>
                  </div>
                </div>

                <div className="flex justify-end text-sm pt-2 border-t">
                  <div className="text-right">
                    <div className="text-muted-foreground text-xs">Completed Date</div>
                    <div>{format(new Date(verification.updatedAt), 'MMM dd, yyyy')}</div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}