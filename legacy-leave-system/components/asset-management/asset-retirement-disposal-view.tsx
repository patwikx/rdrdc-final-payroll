"use client"

// Removed useState - not used in this component
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssetRetirementView } from "./asset-retirement-view"
import { AssetDisposalView } from "./asset-disposal-view"

interface AssetRetirementDisposalViewProps {
  retirableAssetsData: any
  disposableAssetsData: any
  businessUnitId: string
  currentFilters: {
    tab?: 'retirements' | 'disposals'
    categoryId?: string
    search?: string
    page: number
  }
}

export function AssetRetirementDisposalView({
  retirableAssetsData,
  disposableAssetsData,
  businessUnitId,
  currentFilters
}: AssetRetirementDisposalViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    params.delete('page') // Reset page when switching tabs
    
    router.push(`/${businessUnitId}/asset-management/retirements?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Asset Retirements & Disposals</h1>
          <p className="text-sm text-muted-foreground">
            Manage asset retirement and disposal processes
          </p>
        </div>
      </div>

      {/* Tabs for Retirements and Disposals */}
      <Tabs value={currentFilters.tab || 'retirements'} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="retirements">Asset Retirements</TabsTrigger>
          <TabsTrigger value="disposals">Asset Disposals</TabsTrigger>
        </TabsList>
        
        <TabsContent value="retirements" className="space-y-6">
          <AssetRetirementView 
            retirableAssetsData={retirableAssetsData}
            businessUnitId={businessUnitId}
            currentFilters={{
              categoryId: currentFilters.categoryId,
              search: currentFilters.search,
              page: currentFilters.page
            }}
            showCreateButton={true}
          />
        </TabsContent>
        
        <TabsContent value="disposals" className="space-y-6">
          <AssetDisposalView 
            disposableAssetsData={disposableAssetsData}
            businessUnitId={businessUnitId}
            currentFilters={{
              categoryId: currentFilters.categoryId,
              search: currentFilters.search,
              page: currentFilters.page
            }}
            showCreateButton={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}