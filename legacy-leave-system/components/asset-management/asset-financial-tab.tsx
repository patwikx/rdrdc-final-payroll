"use client"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  DollarSign, 
  TrendingDown, 
  Calculator, 
  CreditCard,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { format } from "date-fns"
import { AssetMonthlyDepreciationSchedule } from "./asset-monthly-depreciation-schedule"
import { AssetDetailsData } from "@/lib/actions/asset-details-actions"


interface AssetFinancialTabProps {
  asset: AssetDetailsData
  businessUnitId: string
}

export function AssetFinancialTab({ asset, businessUnitId }: AssetFinancialTabProps) {
  const depreciationPercentage = asset.purchasePrice && asset.accumulatedDepreciation
    ? (Number(asset.accumulatedDepreciation) / Number(asset.purchasePrice)) * 100
    : 0

  const remainingValue = asset.purchasePrice && asset.currentBookValue
    ? Number(asset.currentBookValue)
    : 0



  return (
    <div className="space-y-6">
      {/* Financial Overview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <DollarSign className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Financial Overview</h3>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-6 border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purchase Price</label>
                <div className="text-2xl font-bold mt-1">
                  {asset.purchasePrice 
                    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(asset.purchasePrice)
                    : 'Not Available'
                  }
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purchase Date</label>
                <div className="font-medium mt-1">
                  {asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM dd, yyyy') : 'Not specified'}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Book Value</label>
                <div className="text-2xl font-bold mt-1">
                  {asset.currentBookValue 
                    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(asset.currentBookValue)
                    : 'Not Available'
                  }
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                <div className="mt-1">
                  {asset.isFullyDepreciated ? (
                    <Badge variant="secondary">Fully Depreciated</Badge>
                  ) : (
                    <Badge variant="default">Depreciating</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accumulated Depreciation</label>
                <div className="text-2xl font-bold mt-1">
                  {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(asset.accumulatedDepreciation)}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Depreciation Rate</label>
                <div className="font-medium mt-1">{depreciationPercentage.toFixed(1)}% of purchase price</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Depreciation Progress */}
      {asset.purchasePrice && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <TrendingDown className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Depreciation Progress</h3>
          </div>
          
          <div className="bg-accent/50 border rounded-lg p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Depreciation Progress</span>
                  <span className="font-semibold">{depreciationPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={depreciationPercentage} className="w-full h-3" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-card border rounded-lg">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remaining Value</label>
                  <div className="text-lg font-bold mt-1">
                    {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(remainingValue)}
                  </div>
                </div>
                <div className="p-4 bg-card border rounded-lg">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Salvage Value</label>
                  <div className="text-lg font-bold mt-1">
                    {asset.salvageValue 
                      ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(asset.salvageValue)
                      : '₱0.00'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Depreciation Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Calculator className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Depreciation Configuration</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-card border rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Method</label>
            <div className="mt-2">
              <Badge variant="outline">
                {asset.depreciationMethod?.replace('_', ' ') || 'Not Set'}
              </Badge>
            </div>
          </div>
          <div className="p-4 bg-card border rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Useful Life</label>
            <div className="text-sm font-medium mt-2">
              {(() => {
                // Handle both old format (years + months) and new format (total months)
                let totalMonths = 0;
                
                if (asset.usefulLifeMonths && asset.usefulLifeMonths > 12) {
                  // New format: total months stored in usefulLifeMonths
                  totalMonths = asset.usefulLifeMonths;
                } else {
                  // Old format: years * 12 + additional months
                  totalMonths = (asset.usefulLifeYears || 0) * 12 + (asset.usefulLifeMonths || 0);
                }
                
                if (totalMonths === 0) {
                  return 'Not Set';
                }
                
                const years = Math.floor(totalMonths / 12);
                const months = totalMonths % 12;
                
                if (years > 0 && months > 0) {
                  return `${years} years, ${months} months (${totalMonths} months total)`;
                } else if (years > 0) {
                  return `${years} years (${totalMonths} months total)`;
                } else {
                  return `${months} months`;
                }
              })()}
            </div>
          </div>
          <div className="p-4 bg-card border rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly Depreciation</label>
            <div className="text-sm font-medium mt-2">
              {asset.monthlyDepreciation 
                ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(asset.monthlyDepreciation)
                : 'Not Available'
              }
            </div>
          </div>
          <div className="p-4 bg-card border rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
            <div className="flex items-center gap-2 mt-2">
              {asset.isFullyDepreciated ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">Fully Depreciated</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Depreciating</span>
                </>
              )}
            </div>
          </div>
        </div>

        {asset.depreciationStartDate && (
          <div className="bg-muted/50 border rounded-lg p-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Depreciation Period</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <span className="text-sm text-muted-foreground">Started:</span>
                <div className="font-medium">{format(new Date(asset.depreciationStartDate), 'MMM dd, yyyy')}</div>
              </div>
              {asset.nextDepreciationDate && !asset.isFullyDepreciated && (
                <div>
                  <span className="text-sm text-muted-foreground">Next:</span>
                  <div className="font-medium">{format(new Date(asset.nextDepreciationDate), 'MMM dd, yyyy')}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* GL Account Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <CreditCard className="h-5 w-5" />
          <h3 className="text-lg font-semibold">GL Account Configuration</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/50 border rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Asset Account</label>
            <div className="mt-2">
              {asset.assetAccount ? (
                <div className="space-y-1">
                  <Badge variant="outline" className="font-mono">
                    {asset.assetAccount.accountCode}
                  </Badge>
                  <div className="text-sm font-medium">{asset.assetAccount.accountName}</div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Not configured</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-muted/50 border rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Depreciation Expense Account</label>
            <div className="mt-2">
              {asset.depreciationExpenseAccount ? (
                <div className="space-y-1">
                  <Badge variant="outline" className="font-mono">
                    {asset.depreciationExpenseAccount.accountCode}
                  </Badge>
                  <div className="text-sm font-medium">{asset.depreciationExpenseAccount.accountName}</div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Not configured</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-muted/50 border rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accumulated Depreciation Account</label>
            <div className="mt-2">
              {asset.accumulatedDepAccount ? (
                <div className="space-y-1">
                  <Badge variant="outline" className="font-mono">
                    {asset.accumulatedDepAccount.accountCode}
                  </Badge>
                  <div className="text-sm font-medium">{asset.accumulatedDepAccount.accountName}</div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Not configured</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Depreciation Schedule */}
      <AssetMonthlyDepreciationSchedule 
        assetId={asset.id} 
        businessUnitId={businessUnitId}
      />

    </div>
  )
}