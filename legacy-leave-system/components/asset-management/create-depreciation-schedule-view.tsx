"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ArrowLeft,
  Calendar,
  Save,
  AlertCircle,
  Info
} from "lucide-react"
import { toast } from "sonner"
import { createDepreciationSchedule, CreateScheduleInput } from "@/lib/actions/depreciation-schedule-actions"

interface CreateDepreciationScheduleViewProps {
  businessUnit: {
    id: string
    name: string
    code: string
  }
  businessUnitId: string
  categories: Array<{ id: string; name: string; count: number }>
}

export function CreateDepreciationScheduleView({
  businessUnit,
  businessUnitId,
  categories
}: CreateDepreciationScheduleViewProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CreateScheduleInput>({
    name: "",
    description: "",
    scheduleType: "MONTHLY",
    executionDay: 30,
    includeCategories: [],
    excludeCategories: [],
    isActive: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await createDepreciationSchedule(businessUnitId, formData)
      
      if (result.success) {
        toast.success("Depreciation schedule created successfully!")
        router.push(`/${businessUnitId}/asset-management/depreciation/schedules`)
      } else {
        toast.error(result.error || "Failed to create schedule")
      }
    } catch (error) {
      console.error("Error creating schedule:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCategoryToggle = (categoryId: string, type: 'include' | 'exclude') => {
    setFormData(prev => {
      const otherType = type === 'include' ? 'exclude' : 'include'
      const currentArray = prev[`${type}Categories`]
      const otherArray = prev[`${otherType}Categories`]
      
      // Remove from other array if present
      const newOtherArray = otherArray.filter(id => id !== categoryId)
      
      // Toggle in current array
      const newCurrentArray = currentArray.includes(categoryId)
        ? currentArray.filter(id => id !== categoryId)
        : [...currentArray, categoryId]
      
      return {
        ...prev,
        [`${type}Categories`]: newCurrentArray,
        [`${otherType}Categories`]: newOtherArray
      }
    })
  }

  const getExecutionDayOptions = () => {
    switch (formData.scheduleType) {
      case 'MONTHLY':
        return Array.from({ length: 31 }, (_, i) => i + 1)
      case 'QUARTERLY':
        return [15, 30, 31] // Mid-month or end of month for quarters
      case 'ANNUALLY':
        return [31] // End of year
      default:
        return [30]
    }
  }

  const getExecutionDayLabel = () => {
    switch (formData.scheduleType) {
      case 'MONTHLY':
        return "Day of Month"
      case 'QUARTERLY':
        return "Day of Quarter End Month"
      case 'ANNUALLY':
        return "Day of Year End"
      default:
        return "Execution Day"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Depreciation Schedule</h1>
          <p className="text-muted-foreground">
            Set up automated depreciation calculations for {businessUnit.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Schedule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Monthly Depreciation - All Assets"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="scheduleType">Schedule Type *</Label>
              <Select
                value={formData.scheduleType}
                onValueChange={(value: "MONTHLY" | "QUARTERLY" | "ANNUALLY") => 
                  setFormData(prev => ({ 
                    ...prev, 
                    scheduleType: value,
                    executionDay: value === 'ANNUALLY' ? 31 : 30
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="ANNUALLY">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of what this schedule covers..."
              rows={3}
            />
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Schedule Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="executionDay">{getExecutionDayLabel()} *</Label>
              <Select
                value={formData.executionDay.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, executionDay: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getExecutionDayOptions().map(day => (
                    <SelectItem key={day} value={day.toString()}>
                      Day {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: !!checked }))}
              />
              <Label htmlFor="isActive">Active (schedule will run automatically)</Label>
            </div>
          </div>

          <div className="p-4 bg-muted/50 border rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Schedule Execution</p>
                <p className="mt-1">
                  {formData.scheduleType === 'MONTHLY' && `This schedule will run on day ${formData.executionDay} of each month.`}
                  {formData.scheduleType === 'QUARTERLY' && `This schedule will run on day ${formData.executionDay} of the last month of each quarter (Mar, Jun, Sep, Dec).`}
                  {formData.scheduleType === 'ANNUALLY' && `This schedule will run on December ${formData.executionDay} each year.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Category Filters</h2>
          <p className="text-sm text-muted-foreground">
            Choose which asset categories to include or exclude from this schedule. 
            If no categories are selected, all categories will be included.
          </p>
          
          {categories.length === 0 ? (
            <div className="p-4 bg-muted/50 border rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No asset categories found. All assets will be included in the schedule.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">Include Categories</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {categories.map(category => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`include-${category.id}`}
                        checked={formData.includeCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id, 'include')}
                      />
                      <Label htmlFor={`include-${category.id}`} className="text-sm">
                        {category.name} ({category.count} assets)
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">Exclude Categories</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {categories.map(category => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`exclude-${category.id}`}
                        checked={formData.excludeCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id, 'exclude')}
                      />
                      <Label htmlFor={`exclude-${category.id}`} className="text-sm">
                        {category.name} ({category.count} assets)
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Calendar className="h-4 w-4 mr-2 animate-spin" />
                Creating Schedule...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Schedule
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}