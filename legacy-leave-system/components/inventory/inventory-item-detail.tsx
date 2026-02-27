"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { updateInventoryItem, deleteInventoryItem, sellInventoryItem } from "@/lib/actions/inventory-actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Edit, Trash2, Save, X, DollarSign, Printer } from "lucide-react"
import { format } from "date-fns"

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

interface InventoryItemDetailProps {
  businessUnitId: string
  item: InventoryItem
}

export function InventoryItemDetail({ businessUnitId, item }: InventoryItemDetailProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSellDialog, setShowSellDialog] = useState(false)
  const [sellPrice, setSellPrice] = useState("")
  const [sellQuantity, setSellQuantity] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [saleRemarks, setSaleRemarks] = useState("")

  const [formData, setFormData] = useState({
    itemCode: item.itemCode || "",
    description: item.description,
    quantity: item.quantity.toString(),
    uom: item.uom,
    unitAcquisitionCost: item.unitAcquisitionCost.toString(),
    damageCondition: item.damageCondition || "",
    isDamaged: !item.isServiceable,
    estimatedRecoveryValue: item.estimatedRecoveryValue?.toString() || "",
    remarks: item.remarks || ""
  })

  const handleSave = async () => {
    if (!formData.description || !formData.quantity || !formData.unitAcquisitionCost) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsLoading(true)
    try {
      const result = await updateInventoryItem(item.id, businessUnitId, {
        itemCode: formData.itemCode || undefined,
        description: formData.description,
        quantity: parseInt(formData.quantity),
        uom: formData.uom,
        unitAcquisitionCost: parseFloat(formData.unitAcquisitionCost),
        damageCondition: formData.damageCondition || undefined,
        isDamaged: formData.isDamaged,
        estimatedRecoveryValue: formData.estimatedRecoveryValue ? parseFloat(formData.estimatedRecoveryValue) : undefined,
        remarks: formData.remarks || undefined
      })

      if (result.success) {
        toast.success(result.message)
        setIsEditing(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Failed to update item")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteInventoryItem(item.id, businessUnitId)
      if (result.success) {
        toast.success(result.message)
        router.push(`/${businessUnitId}/inventory`)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Failed to delete item")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      itemCode: item.itemCode || "",
      description: item.description,
      quantity: item.quantity.toString(),
      uom: item.uom,
      unitAcquisitionCost: item.unitAcquisitionCost.toString(),
      damageCondition: item.damageCondition || "",
      isDamaged: !item.isServiceable,
      estimatedRecoveryValue: item.estimatedRecoveryValue?.toString() || "",
      remarks: item.remarks || ""
    })
    setIsEditing(false)
  }

  const handleSell = async () => {
    if (!sellPrice || parseFloat(sellPrice) <= 0) {
      toast.error("Please enter a valid selling price")
      return
    }

    if (!sellQuantity || parseFloat(sellQuantity) <= 0) {
      toast.error("Please enter a valid quantity")
      return
    }

    if (parseFloat(sellQuantity) > item.quantity) {
      toast.error(`Cannot sell more than ${item.quantity} ${item.uom}`)
      return
    }

    setIsLoading(true)
    try {
      const result = await sellInventoryItem(
        item.id,
        businessUnitId,
        parseFloat(sellPrice),
        parseInt(sellQuantity),
        buyerName || undefined,
        saleRemarks || undefined
      )
      if (result.success) {
        toast.success(result.message)
        setShowSellDialog(false)
        setSellPrice("")
        setSellQuantity("")
        setBuyerName("")
        setSaleRemarks("")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Failed to sell item")
    } finally {
      setIsLoading(false)
    }
  }

  const totalSellingAmount = sellPrice && sellQuantity 
    ? parseFloat(sellPrice) * parseFloat(sellQuantity) 
    : 0
  const acquisitionCostForSale = sellQuantity 
    ? parseFloat(sellQuantity) * item.unitAcquisitionCost 
    : 0
  const profitLoss = totalSellingAmount - acquisitionCostForSale

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
    <>
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: letter landscape;
            margin: 0.5in;
          }
          
          body * {
            visibility: hidden;
          }
          
          #print-content, #print-content * {
            visibility: visible;
          }
          
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-break {
            page-break-after: always;
          }
        }
      `}} />

      {/* Print Content - Hidden on screen, visible on print */}
      <div id="print-content" className="hidden print:block">
        <div className="p-6 bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
          {/* Header */}
          <div className="text-center mb-4 border-b-2 border-black pb-2">
            <h1 className="text-xl font-bold mb-1">DAMAGED INVENTORY REPORT</h1>
            <p className="text-xs">Generated on {format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}</p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            {/* Left Column */}
            <div>
              {/* Item Information */}
              <div className="mb-3">
                <h2 className="text-sm font-bold mb-1 bg-gray-200 p-1">ITEM INFORMATION</h2>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 font-semibold w-2/5">Item Code:</td>
                      <td className="py-1">{item.itemCode || 'N/A'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Description:</td>
                      <td className="py-1">{item.description}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Status:</td>
                      <td className="py-1">{item.status}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Serviceable:</td>
                      <td className="py-1">{item.isServiceable ? 'Yes' : 'No'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Damage Information */}
              <div className="mb-3">
                <h2 className="text-sm font-bold mb-1 bg-gray-200 p-1">DAMAGE INFORMATION</h2>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 font-semibold w-2/5">Damage Type:</td>
                      <td className="py-1">{item.damageType?.replace(/_/g, ' ') || 'N/A'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Condition:</td>
                      <td className="py-1">{item.damageCondition || 'N/A'}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Location:</td>
                      <td className="py-1">{item.location || 'N/A'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Quantity Information */}
              <div className="mb-3">
                <h2 className="text-sm font-bold mb-1 bg-gray-200 p-1">QUANTITY INFORMATION</h2>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 font-semibold w-2/5">Available Qty:</td>
                      <td className="py-1 font-bold">{item.quantity} {item.uom}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Qty Sold:</td>
                      <td className="py-1 font-bold">{item.soldQuantity || 0} {item.uom}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Unit:</td>
                      <td className="py-1">{item.uom}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column */}
            <div>
              {/* Financial Information */}
              <div className="mb-3">
                <h2 className="text-sm font-bold mb-1 bg-gray-200 p-1">FINANCIAL INFORMATION</h2>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 font-semibold w-2/5">Unit Acq. Cost:</td>
                      <td className="py-1">₱{item.unitAcquisitionCost.toLocaleString()}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Total Acq. Cost:</td>
                      <td className="py-1 font-bold">₱{item.totalAcquisitionCost.toLocaleString()}</td>
                    </tr>
                    {item.estimatedRecoveryValue && (
                      <tr className="border-b">
                        <td className="py-1 font-semibold">Est. Recovery:</td>
                        <td className="py-1">₱{item.estimatedRecoveryValue.toLocaleString()}</td>
                      </tr>
                    )}
                    {item.unitSellingPrice && (
                      <>
                        <tr className="border-b">
                          <td className="py-1 font-semibold">Unit Sell Price:</td>
                          <td className="py-1">₱{item.unitSellingPrice.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-1 font-semibold">Total Sell Amt:</td>
                          <td className="py-1 font-bold">₱{item.totalSellingAmount.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b bg-gray-100">
                          <td className="py-1 font-semibold">Profit/Loss:</td>
                          <td className={`py-1 font-bold ${item.profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            ₱{item.profitLoss.toLocaleString()}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sale Information */}
              {item.soldQuantity && item.soldQuantity > 0 && (
                <div className="mb-3">
                  <h2 className="text-sm font-bold mb-1 bg-gray-200 p-1">SALE INFORMATION</h2>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b">
                        <td className="py-1 font-semibold w-2/5">Qty Sold:</td>
                        <td className="py-1">{item.soldQuantity} {item.uom}</td>
                      </tr>
                      {item.saleDate && (
                        <tr className="border-b">
                          <td className="py-1 font-semibold">Sale Date:</td>
                          <td className="py-1">{format(new Date(item.saleDate), "MMM dd, yyyy")}</td>
                        </tr>
                      )}
                      {item.saleNotes && (
                        <tr className="border-b">
                          <td className="py-1 font-semibold">Notes:</td>
                          <td className="py-1">{item.saleNotes}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Record Information */}
              <div className="mb-3">
                <h2 className="text-sm font-bold mb-1 bg-gray-200 p-1">RECORD INFORMATION</h2>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 font-semibold w-2/5">Created:</td>
                      <td className="py-1">{format(new Date(item.createdAt), "MMM dd, yyyy h:mm a")}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 font-semibold">Updated:</td>
                      <td className="py-1">{format(new Date(item.updatedAt), "MMM dd, yyyy h:mm a")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Remarks - Full Width */}
          {item.remarks && (
            <div className="mb-2">
              <h2 className="text-sm font-bold mb-1 bg-gray-200 p-1">REMARKS</h2>
              <p className="text-xs p-1 border">{item.remarks}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 pt-2 border-t border-black text-xs text-center">
            <p>System-generated report • Report ID: {item.id}</p>
          </div>
        </div>
      </div>

      {/* Sell Dialog */}
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sell Item</DialogTitle>
            <DialogDescription>
              Record the sale of {item.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Item Summary */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Available Quantity:</span>
                  <p className="font-medium text-lg">{item.quantity} {item.uom}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Acquisition Cost:</span>
                  <p className="font-medium text-lg">₱{item.unitAcquisitionCost.toLocaleString()}/{item.uom}</p>
                </div>
              </div>
            </div>

            {/* Sell Form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sellQuantity">
                  Quantity to Sell <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sellQuantity"
                  type="number"
                  min="1"
                  max={item.quantity}
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Max: {item.quantity} {item.uom}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sellPrice">
                  Selling Price (per {item.uom}) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sellPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buyerName">Buyer Name</Label>
              <Input
                id="buyerName"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Enter buyer name (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="saleRemarks">Sale Remarks</Label>
              <Textarea
                id="saleRemarks"
                value={saleRemarks}
                onChange={(e) => setSaleRemarks(e.target.value)}
                placeholder="Additional notes about this sale"
                rows={3}
              />
            </div>

            {/* Calculation Summary */}
            {sellQuantity && sellPrice && parseFloat(sellQuantity) > 0 && parseFloat(sellPrice) > 0 && (
              <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                <h4 className="font-semibold mb-3">Sale Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-medium">{sellQuantity} {item.uom}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Unit Price:</span>
                    <span className="font-medium">₱{parseFloat(sellPrice).toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="text-muted-foreground">Total Selling Amount:</span>
                    <span className="font-bold text-lg">₱{totalSellingAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Acquisition Cost:</span>
                    <span>₱{(parseFloat(sellQuantity) * item.unitAcquisitionCost).toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">Profit/Loss:</span>
                    <span className={`font-bold text-lg ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profitLoss >= 0 ? '+' : ''}₱{profitLoss.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSellDialog(false)
                  setSellPrice("")
                  setSellQuantity("")
                  setBuyerName("")
                  setSaleRemarks("")
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleSell} disabled={isLoading}>
                {isLoading ? "Recording Sale..." : "Record Sale"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{item.description}</h1>
              {getStatusBadge(item.status)}
            </div>
            <p className="text-muted-foreground mt-1">
              {item.itemCode && <span className="font-mono">{item.itemCode} • </span>}
              {item.quantity} {item.uom} • ₱{item.unitAcquisitionCost.toLocaleString()}/{item.uom}
            </p>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>
                {!item.unitSellingPrice && (
                  <Button onClick={() => setShowSellDialog(true)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Sell Item
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Damage Information */}
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Damage Information</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label className="text-muted-foreground">Damage Type</Label>
              <p className="text-lg font-medium mt-1">{item.damageType?.replace(/_/g, ' ') || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Location</Label>
              <p className="text-lg font-medium mt-1">{item.location || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Condition</Label>
              <p className="text-lg font-medium mt-1">{item.damageCondition || '-'}</p>
            </div>
          </div>
        </div>

        {/* Item & Financial Details */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left - Item Details */}
          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Item Details</h2>
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity <span className="text-red-500">*</span></Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uom">Unit <span className="text-red-500">*</span></Label>
                    <Input
                      id="uom"
                      value={formData.uom}
                      onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitAcquisitionCost">Cost per Unit <span className="text-red-500">*</span></Label>
                  <Input
                    id="unitAcquisitionCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitAcquisitionCost}
                    onChange={(e) => setFormData({ ...formData, unitAcquisitionCost: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedRecoveryValue">Est. Recovery Value</Label>
                  <Input
                    id="estimatedRecoveryValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.estimatedRecoveryValue}
                    onChange={(e) => setFormData({ ...formData, estimatedRecoveryValue: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isDamaged"
                    checked={formData.isDamaged}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDamaged: checked })}
                  />
                  <Label htmlFor="isDamaged">Non-serviceable</Label>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Item Code</Label>
                  <p className="text-lg font-medium mt-1">{item.itemCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="text-lg font-medium mt-1">{item.quantity} {item.uom}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Acquisition Cost</Label>
                  <p className="text-lg font-medium mt-1">₱{item.unitAcquisitionCost.toLocaleString()}/{item.uom}</p>
                  <p className="text-sm text-muted-foreground">Total: ₱{item.totalAcquisitionCost.toLocaleString()}</p>
                </div>
                {item.estimatedRecoveryValue && (
                  <div>
                    <Label className="text-muted-foreground">Est. Recovery Value</Label>
                    <p className="text-lg font-medium mt-1">₱{item.estimatedRecoveryValue.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right - Financial Summary */}
          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Financial Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Acquisition Cost:</span>
                <span className="font-medium">₱{item.totalAcquisitionCost.toLocaleString()}</span>
              </div>
              {item.unitSellingPrice && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selling Amount:</span>
                    <span className="font-medium">₱{item.totalSellingAmount.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">Profit/Loss:</span>
                    <span className={`font-bold text-lg ${item.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₱{item.profitLoss.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>

            {item.soldQuantity && item.soldQuantity > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-3">Sale Information</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Quantity Sold:</span>
                    <p className="font-medium">{item.soldQuantity} {item.uom}</p>
                  </div>
                  {item.saleDate && (
                    <div>
                      <span className="text-muted-foreground">Sale Date:</span>
                      <p className="font-medium">{format(new Date(item.saleDate), "MMM dd, yyyy 'at' h:mm a")}</p>
                    </div>
                  )}
                  {item.saleNotes && (
                    <div>
                      <span className="text-muted-foreground">Notes:</span>
                      <p className="font-medium">{item.saleNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">{format(new Date(item.createdAt), "MMM dd, yyyy 'at' h:mm a")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <p className="font-medium">{format(new Date(item.updatedAt), "MMM dd, yyyy 'at' h:mm a")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Remarks */}
        {(item.remarks || isEditing) && (
          <div className="border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Remarks</h2>
            {isEditing ? (
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Additional notes or comments"
                rows={4}
              />
            ) : (
              <p className="text-muted-foreground">{item.remarks || "No remarks"}</p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

