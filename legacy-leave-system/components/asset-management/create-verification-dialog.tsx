"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, ClipboardList, Loader2, Users, MapPin, Package } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  createInventoryVerification, 
  getAvailableEmployees,
  getAvailableLocations,
  getAvailableCategories,
  CreateVerificationData
} from "@/lib/actions/inventory-verification-actions"

interface CreateVerificationDialogProps {
  businessUnitId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateVerificationDialog({
  businessUnitId,
  open,
  onOpenChange,
  onSuccess
}: CreateVerificationDialogProps) {
  const [verificationName, setVerificationName] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [assignedTo, setAssignedTo] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Data
  const [employees, setEmployees] = useState<any[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, businessUnitId])

  const loadData = async () => {
    setIsLoadingData(true)
    try {
      const [employeesData, locationsData, categoriesData] = await Promise.all([
        getAvailableEmployees(businessUnitId),
        getAvailableLocations(businessUnitId),
        getAvailableCategories(businessUnitId)
      ])
      
      setEmployees(employeesData)
      setLocations(locationsData)
      setCategories(categoriesData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to load data")
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleSubmit = async () => {
    if (!verificationName.trim()) {
      toast.error("Verification name is required")
      return
    }

    if (assignedTo.length === 0) {
      toast.error("Please assign at least one employee")
      return
    }

    setIsLoading(true)
    try {
      const verificationData: CreateVerificationData = {
        verificationName,
        description: description || undefined,
        startDate,
        endDate,
        assignedTo,
        locations: selectedLocations,
        categories: selectedCategories,
        businessUnitId
      }

      const result = await createInventoryVerification(verificationData)

      if (result.error) {
        toast.error(result.error)
      } else if ('success' in result) {
        toast.success(result.success)
        onSuccess()
      }
    } catch (error) {
      console.error("Error creating verification:", error)
      toast.error("Failed to create verification")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setVerificationName("")
    setDescription("")
    setStartDate(new Date())
    setEndDate(undefined)
    setAssignedTo([])
    setSelectedLocations([])
    setSelectedCategories([])
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const handleEmployeeToggle = (employeeId: string, checked: boolean) => {
    if (checked) {
      setAssignedTo(prev => [...prev, employeeId])
    } else {
      setAssignedTo(prev => prev.filter(id => id !== employeeId))
    }
  }

  const handleLocationToggle = (location: string, checked: boolean) => {
    if (checked) {
      setSelectedLocations(prev => [...prev, location])
    } else {
      setSelectedLocations(prev => prev.filter(l => l !== location))
    }
  }

  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories(prev => [...prev, categoryId])
    } else {
      setSelectedCategories(prev => prev.filter(id => id !== categoryId))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Create Inventory Verification
          </DialogTitle>
          <DialogDescription>
            Set up a new inventory verification cycle to count and verify assets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verification-name">Verification Name *</Label>
              <Input
                id="verification-name"
                value={verificationName}
                onChange={(e) => setVerificationName(e.target.value)}
                placeholder="e.g., Q4 2024 Physical Count"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this verification cycle..."
                rows={3}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {isLoadingData ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Assigned Employees */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned Employees * ({assignedTo.length} selected)
                </Label>
                <div className="max-h-40 overflow-y-auto border rounded p-3 space-y-2">
                  {employees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`employee-${employee.id}`}
                        checked={assignedTo.includes(employee.id)}
                        onCheckedChange={(checked) => handleEmployeeToggle(employee.id, checked === true)}
                      />
                      <Label htmlFor={`employee-${employee.id}`} className="text-sm flex-1">
                        {employee.name} ({employee.employeeId})
                        {employee.department && (
                          <span className="text-muted-foreground ml-2">• {employee.department.name}</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Locations Filter */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Locations ({selectedLocations.length > 0 ? `${selectedLocations.length} selected` : 'All locations'})
                </Label>
                <div className="max-h-32 overflow-y-auto border rounded p-3 space-y-2">
                  {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No locations found</p>
                  ) : (
                    locations.map((location) => (
                      <div key={location} className="flex items-center space-x-2">
                        <Checkbox
                          id={`location-${location}`}
                          checked={selectedLocations.includes(location)}
                          onCheckedChange={(checked) => handleLocationToggle(location, checked === true)}
                        />
                        <Label htmlFor={`location-${location}`} className="text-sm">
                          {location}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to include all locations
                </p>
              </div>

              {/* Categories Filter */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Categories ({selectedCategories.length > 0 ? `${selectedCategories.length} selected` : 'All categories'})
                </Label>
                <div className="max-h-32 overflow-y-auto border rounded p-3 space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={(checked) => handleCategoryToggle(category.id, checked === true)}
                      />
                      <Label htmlFor={`category-${category.id}`} className="text-sm">
                        {category.name} ({category.assetCount} assets)
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to include all categories
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || isLoadingData}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Verification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}