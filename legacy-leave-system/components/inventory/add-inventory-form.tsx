"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

import { addInventoryItem } from "@/lib/actions/inventory-actions"
import { DAMAGE_TYPES, DAMAGE_SEVERITIES } from "@/lib/constants/inventory-constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface AddInventoryFormProps {
  businessUnitId: string
}

export function AddInventoryForm({ businessUnitId }: AddInventoryFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    damageType: "OTHER",
    damageSeverity: "MINOR",
    location: "",
    tenantName: "",
    tenantContact: "",
    itemCode: "",
    description: "",
    quantity: "",
    uom: "pcs",
    unitAcquisitionCost: "",
    damageCondition: "",
    isDamaged: false,
    estimatedRecoveryValue: "",
    remarks: ""
  })

  const totalAcquisitionCost = formData.quantity && formData.unitAcquisitionCost
    ? parseFloat(formData.quantity) * parseFloat(formData.unitAcquisitionCost)
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.description || !formData.quantity || !formData.unitAcquisitionCost) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsLoading(true)
    try {
      const result = await addInventoryItem({
        businessUnitId,
        damageType: formData.damageType,
        damageSeverity: formData.damageSeverity,
        location: formData.location || undefined,
        tenantName: formData.tenantName || undefined,
        tenantContact: formData.tenantContact || undefined,
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
        router.push(`/${businessUnitId}/inventory`)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Failed to add item")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Damaged Inventory Item</h1>
          <p className="text-muted-foreground mt-1">
            Record a new damaged item with incident details
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${businessUnitId}/inventory`)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Adding..." : "Add Item"}
          </Button>
        </div>
      </div>

      {/* Item Details */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Item Details</h3>
          <p className="text-sm text-muted-foreground">Basic information about the item</p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">
            Item Description <span className="text-red-500">*</span>
          </Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g., Office Chair, Laptop, Table"
            required
          />
        </div>

        <div className="grid grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label htmlFor="itemCode">Item Code</Label>
            <Input
              id="itemCode"
              value={formData.itemCode}
              onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
              placeholder="e.g., ITM-001"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="uom">
              Unit <span className="text-red-500">*</span>
            </Label>
            <Input
              id="uom"
              value={formData.uom}
              onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
              placeholder="pcs, kg, etc."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unitAcquisitionCost">
              Cost per Unit <span className="text-red-500">*</span>
            </Label>
            <Input
              id="unitAcquisitionCost"
              type="number"
              step="0.01"
              min="0"
              value={formData.unitAcquisitionCost}
              onChange={(e) => setFormData({ ...formData, unitAcquisitionCost: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Non-serviceable</Label>
            <div className="flex items-center h-10 px-3 border rounded-md">
              <Switch
                id="isDamaged"
                checked={formData.isDamaged}
                onCheckedChange={(checked) => setFormData({ ...formData, isDamaged: checked })}
              />
            </div>
          </div>
        </div>

        {totalAcquisitionCost > 0 && (
          <div className="bg-muted/50 border rounded-lg p-3">
            <p className="text-sm font-medium">
              Total Acquisition Cost: <span className="text-lg">₱{totalAcquisitionCost.toLocaleString()}</span>
            </p>
          </div>
        )}
      </div>

      <div className="border-t" />

      {/* Additional Information */}
      <div className="grid grid-cols-3 gap-8">
        {/* Left Column - Damage Information */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Damage Information</h3>
            <p className="text-sm text-muted-foreground">Details about the damage</p>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="damageType">
                  Damage Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.damageType}
                  onValueChange={(value) => setFormData({ ...formData, damageType: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAMAGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="damageSeverity">
                  Severity <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.damageSeverity}
                  onValueChange={(value) => setFormData({ ...formData, damageSeverity: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAMAGE_SEVERITIES.map((severity) => (
                      <SelectItem key={severity.value} value={severity.value}>
                        {severity.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="damageCondition">Damage Condition</Label>
              <Input
                id="damageCondition"
                value={formData.damageCondition}
                onChange={(e) => setFormData({ ...formData, damageCondition: e.target.value })}
                placeholder="e.g., Minor scratches"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Warehouse A"
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
          </div>
        </div>

        {/* Middle Column - Responsible Party */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Responsible Party</h3>
            <p className="text-sm text-muted-foreground">Who is responsible? (optional)</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantName">Tenant/Party Name</Label>
              <Input
                id="tenantName"
                value={formData.tenantName}
                onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                placeholder="Enter name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantContact">Contact Number</Label>
              <Input
                id="tenantContact"
                value={formData.tenantContact}
                onChange={(e) => setFormData({ ...formData, tenantContact: e.target.value })}
                placeholder="Enter contact"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Additional Notes */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Additional Notes</h3>
            <p className="text-sm text-muted-foreground">Any other relevant information</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Additional notes, incident details..."
              rows={12}
            />
          </div>
        </div>
      </div>
    </form>
  )
}
