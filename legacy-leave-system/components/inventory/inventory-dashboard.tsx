"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Package, DollarSign, TrendingUp, TrendingDown, Eye } from "lucide-react"
import Link from "next/link"

interface InventorySummary {
  totalItems: number
  totalAcquisitionCost: number
  totalSellingAmount: number
  totalProfitLoss: number
  statusCounts: {
    available: number
    sold: number
    damaged: number
  }
}

interface InventoryItem {
  id: string
  itemCode: string | null
  description: string
  quantity: number
  uom: string
  unitAcquisitionCost: number
  totalAcquisitionCost: number
  damageType: string | null
  damageCondition: string | null
  location: string | null
  isServiceable: boolean
  estimatedRecoveryValue: number | null
  unitSellingPrice: number | null
  totalSellingAmount: number
  soldQuantity: number | null
  saleDate: Date | null
  saleNotes: string | null
  profitLoss: number
  status: string
  remarks: string | null
  createdAt: Date
  updatedAt: Date
}

interface InventoryDashboardProps {
  businessUnitId: string
  summary: InventorySummary
  items: InventoryItem[]
}

export function InventoryDashboard({
  businessUnitId,
  summary,
  items
}: InventoryDashboardProps) {

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Available</Badge>
      case 'SOLD':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Sold</Badge>
      case 'DAMAGED':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Damaged</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8" />
            Inventory
          </h1>
          <p className="text-muted-foreground mt-1">
            Track items, costs, and profit/loss
          </p>
        </div>
        <Button asChild>
          <Link href={`/${businessUnitId}/inventory/add`}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Link>
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-6 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Total Items</div>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold mt-2">{summary.totalItems}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {summary.statusCounts.available} available, {summary.statusCounts.sold} sold
          </div>
        </div>

        <div className="p-6 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Acquisition Cost</div>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold mt-2">₱{summary.totalAcquisitionCost.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">Total invested</div>
        </div>

        <div className="p-6 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Selling Amount</div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold mt-2">₱{summary.totalSellingAmount.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">Total revenue</div>
        </div>

        <div className="p-6 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Profit/Loss</div>
            {summary.totalProfitLoss >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </div>
          <div className={`text-3xl font-bold mt-2 ${summary.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₱{summary.totalProfitLoss.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {summary.totalProfitLoss >= 0 ? 'Profit' : 'Loss'}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">All Items</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Acquisition Cost</TableHead>
              <TableHead>Damage Info</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No items yet</p>
                  <Button asChild className="mt-4" size="sm">
                    <Link href={`/${businessUnitId}/inventory/add`}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Item
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.itemCode || '-'}</TableCell>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell>{item.quantity} {item.uom}</TableCell>
                  <TableCell>
                    <div>₱{item.totalAcquisitionCost.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      ₱{item.unitAcquisitionCost.toLocaleString()}/{item.uom}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{item.damageType?.replace(/_/g, ' ') || '-'}</div>
                      {item.damageCondition && (
                        <div className="text-xs text-muted-foreground">{item.damageCondition}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {item.location || '-'}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={`/${businessUnitId}/inventory/${item.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  )
}
