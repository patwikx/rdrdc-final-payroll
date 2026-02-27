"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { CalendarIcon, Calculator, Package, DollarSign, Settings, History } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { Switch } from "@/components/ui/switch"

import { toast } from "sonner"
import { AccountType } from "@prisma/client"
import { 
  createAsset, 
  getAssetCategories, 
  getDepartments, 
  getGLAccounts, 
  generateItemCode,
  CreateAssetData 
} from "@/lib/actions/create-asset-actions"


interface CreateAssetFormProps {
  businessUnitId: string
}

interface AssetCategory {
  id: string
  name: string
  code: string
  defaultAssetAccountId: string | null
  defaultDepreciationExpenseAccountId: string | null
  defaultAccumulatedDepAccountId: string | null
  defaultAssetAccount: { id: string; accountCode: string; accountName: string } | null
  defaultDepExpAccount: { id: string; accountCode: string; accountName: string } | null
  defaultAccDepAccount: { id: string; accountCode: string; accountName: string } | null
}

interface Department {
  id: string
  name: string
  code: string | null
}

interface GLAccount {
  id: string
  accountCode: string
  accountName: string
  accountType: AccountType
}

export function CreateAssetForm({ businessUnitId }: CreateAssetFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([])
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null)
  const [autoGenerateCode, setAutoGenerateCode] = useState(true)
  const [isPreDepreciated, setIsPreDepreciated] = useState(false)


  const form = useForm<CreateAssetData>({
    defaultValues: {
      itemCode: "",
      description: "",
      serialNumber: "",
      modelNumber: "",
      brand: "",
      categoryId: "",
      departmentId: "",
      quantity: 1,
      location: "",
      notes: "",
      purchasePrice: undefined,
      salvageValue: 0,
      usefulLifeYears: 0,
      usefulLifeMonths: undefined,
      depreciationMethod: "STRAIGHT_LINE",
      status: "AVAILABLE",
      isActive: true,
      // Pre-depreciation defaults
      isPreDepreciated: false,
      useSystemEntryAsStart: false,
      priorDepreciationAmount: 0,
      priorDepreciationMonths: 0
    }
  })

  const watchedCategoryId = form.watch("categoryId")
  const watchedDepreciationMethod = form.watch("depreciationMethod")
  const watchedPurchasePrice = form.watch("purchasePrice")
  const watchedUsefulLifeMonths = form.watch("usefulLifeMonths")
  const watchedSalvageValue = form.watch("salvageValue")
  const watchedIsPreDepreciated = form.watch("isPreDepreciated")
  const watchedOriginalPurchasePrice = form.watch("originalPurchasePrice")
  const watchedPriorDepreciationAmount = form.watch("priorDepreciationAmount")
  const watchedSystemEntryBookValue = form.watch("systemEntryBookValue")

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, departmentsData, accountsData] = await Promise.all([
          getAssetCategories(businessUnitId),
          getDepartments(businessUnitId),
          getGLAccounts()
        ])
        
        setCategories(categoriesData)
        setDepartments(departmentsData)
        setGLAccounts(accountsData)
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Failed to load form data")
      }
    }
    
    loadData()
  }, [businessUnitId])

  // Auto-sync pre-depreciation fields with standard fields
  useEffect(() => {
    if (watchedIsPreDepreciated) {
      const originalPurchaseDate = form.watch("originalPurchaseDate")
      const originalPurchasePrice = form.watch("originalPurchasePrice")
      const originalUsefulLifeMonths = form.watch("originalUsefulLifeMonths")
      const systemEntryDate = form.watch("systemEntryDate")

      // Sync purchase information
      if (originalPurchaseDate) {
        form.setValue("purchaseDate", originalPurchaseDate)
      }
      if (originalPurchasePrice) {
        form.setValue("purchasePrice", originalPurchasePrice)
      }
      
      // Sync depreciation information
      if (originalUsefulLifeMonths !== undefined) {
        form.setValue("usefulLifeMonths", originalUsefulLifeMonths)
        form.setValue("usefulLifeYears", 0)
      }
      
      // Set depreciation start date to system entry date if useSystemEntryAsStart is true
      if (systemEntryDate && form.watch("useSystemEntryAsStart")) {
        form.setValue("depreciationStartDate", systemEntryDate)
      }
    }
  }, [
    watchedIsPreDepreciated,
    form.watch("originalPurchaseDate"),
    form.watch("originalPurchasePrice"),
    form.watch("originalUsefulLifeMonths"),
    form.watch("systemEntryDate"),
    form.watch("useSystemEntryAsStart"),
    form
  ])

  // Handle category selection
  useEffect(() => {
    if (watchedCategoryId) {
      const category = categories.find(c => c.id === watchedCategoryId)
      setSelectedCategory(category || null)
      
      if (category) {
        // Auto-populate GL accounts from category defaults
        if (category.defaultAssetAccountId) {
          form.setValue("assetAccountId", category.defaultAssetAccountId)
        }
        if (category.defaultDepreciationExpenseAccountId) {
          form.setValue("depreciationExpenseAccountId", category.defaultDepreciationExpenseAccountId)
        }
        if (category.defaultAccumulatedDepAccountId) {
          form.setValue("accumulatedDepAccountId", category.defaultAccumulatedDepAccountId)
        }
        
        // Generate item code if auto-generate is enabled
        if (autoGenerateCode) {
          generateItemCode(category.id).then(code => {
            form.setValue("itemCode", code)
          }).catch(error => {
            console.error("Error generating item code:", error)
          })
        }
      }
    }
  }, [watchedCategoryId, categories, form, autoGenerateCode])

  // Calculate estimated monthly depreciation
  const calculateMonthlyDepreciation = () => {
    // Handle pre-depreciated assets
    if (watchedIsPreDepreciated && watchedSystemEntryBookValue && form.watch("originalUsefulLifeMonths")) {
      const remainingBookValue = watchedSystemEntryBookValue - (watchedSalvageValue || 0)
      const originalTotalMonths = form.watch("originalUsefulLifeMonths") || 0
      const priorMonths = watchedPriorDepreciationAmount ? form.watch("priorDepreciationMonths") || 0 : 0
      const remainingMonths = originalTotalMonths - priorMonths
      
      return remainingMonths > 0 ? remainingBookValue / remainingMonths : 0
    }
    
    // Standard depreciation calculation
    if (!watchedPurchasePrice || !watchedUsefulLifeMonths || !watchedDepreciationMethod) {
      return 0
    }
    
    const purchasePrice = watchedPurchasePrice
    const salvageValue = watchedSalvageValue || 0
    const depreciableAmount = purchasePrice - salvageValue
    const totalMonths = watchedUsefulLifeMonths
    
    switch (watchedDepreciationMethod) {
      case 'STRAIGHT_LINE':
        return totalMonths > 0 ? depreciableAmount / totalMonths : 0
      case 'DECLINING_BALANCE':
        // Assuming 200% declining balance (double declining)
        const usefulLifeYears = totalMonths / 12
        const rate = (2 / usefulLifeYears) * 100
        return (purchasePrice * rate / 100) / 12
      default:
        return 0
    }
  }

  const onSubmit = async (data: CreateAssetData) => {
    setIsLoading(true)
    try {
      const result = await createAsset(data, businessUnitId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        
        // Redirect to the asset details page where QR code will be automatically displayed
        if (result.data?.id) {
          router.push(`/${businessUnitId}/asset-management/assets/${result.data.id}`)
        } else {
          // Fallback to assets list
          router.push(`/${businessUnitId}/asset-management/assets`)
        }
      }
    } catch (error) {
      toast.error("Failed to create asset")
    } finally {
      setIsLoading(false)
    }
  }



  const assetAccounts = glAccounts.filter(acc => acc.accountType === 'ASSET')
  const expenseAccounts = glAccounts.filter(acc => acc.accountType === 'EXPENSE')

  return (
    <div className="w-full max-w-none px-2 sm:px-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Create New Asset</h1>
              <p className="text-sm text-muted-foreground">
                Add a new asset to the system with complete configuration
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Asset"}
              </Button>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-border">
              <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <Package className="h-5 w-5" />
                Basic Information
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.filter(category => category.id && category.id.trim() !== '').map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name} ({category.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center justify-between">
                        Item Code <span className="text-red-500">*</span>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={autoGenerateCode}
                            onCheckedChange={setAutoGenerateCode}
                            disabled={!selectedCategory}
                          />
                          <span className="text-xs text-muted-foreground">Auto-generate</span>
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          disabled={autoGenerateCode}
                          placeholder="Enter item code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="AVAILABLE">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              Available
                            </div>
                          </SelectItem>
                          <SelectItem value="DEPLOYED">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              Deployed
                            </div>
                          </SelectItem>
                          <SelectItem value="IN_MAINTENANCE">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                              In Maintenance
                            </div>
                          </SelectItem>
                          <SelectItem value="RETIRED">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                              Retired
                            </div>
                          </SelectItem>
                          <SelectItem value="LOST">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                              Lost
                            </div>
                          </SelectItem>
                          <SelectItem value="DAMAGED">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                              Damaged
                            </div>
                          </SelectItem>
                          <SelectItem value="FULLY_DEPRECIATED">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                              Fully Depreciated
                            </div>
                          </SelectItem>
                          <SelectItem value="DISPOSED">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-black"></div>
                              Disposed
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter asset description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter serial number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter brand" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modelNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter model number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.filter(dept => dept.id && dept.id.trim() !== '').map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name} {dept.code && `(${dept.code})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Enter additional notes" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center space-x-2">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Active Asset
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Purchase Information */}
          {!(watchedIsPreDepreciated || isPreDepreciated) && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-border">
                <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Purchase Information
                </h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Purchase Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyExpiry"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Warranty Expiry</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          )}



          {/* Depreciation Configuration - Only show when pre-depreciation is NOT enabled */}
          {!(watchedIsPreDepreciated || isPreDepreciated) && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-border">
                <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Depreciation Configuration
                </h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="depreciationMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depreciation Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="STRAIGHT_LINE">Straight Line</SelectItem>
                            <SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem>
                            <SelectItem value="UNITS_OF_PRODUCTION">Units of Production</SelectItem>
                            <SelectItem value="SUM_OF_YEARS_DIGITS">Sum of Years Digits</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="depreciationStartDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Depreciation Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                                    <FormField
                    control={form.control}
                    name="usefulLifeMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Useful Life (Months)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="salvageValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salvage Value</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>


                {/* Method-specific fields */}
                {watchedDepreciationMethod === 'DECLINING_BALANCE' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="depreciationRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Depreciation Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {watchedDepreciationMethod === 'UNITS_OF_PRODUCTION' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="totalExpectedUnits"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Expected Units</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Depreciation Preview */}
                {((watchedPurchasePrice && watchedUsefulLifeMonths) || (watchedIsPreDepreciated && watchedSystemEntryBookValue)) && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">
                      {watchedIsPreDepreciated ? "Future Depreciation Preview" : "Depreciation Preview"}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          {watchedIsPreDepreciated ? "Current Book Value:" : "Purchase Price:"}
                        </span>
                        <p className="font-medium">
                          ₱{(watchedIsPreDepreciated ? (watchedSystemEntryBookValue || 0) : (watchedPurchasePrice || 0)).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Salvage Value:</span>
                        <p className="font-medium">₱{(watchedSalvageValue || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {watchedIsPreDepreciated ? "Remaining Depreciable:" : "Depreciable Amount:"}
                        </span>
                        <p className="font-medium">
                          ₱{watchedIsPreDepreciated 
                            ? ((watchedSystemEntryBookValue || 0) - (watchedSalvageValue || 0)).toLocaleString()
                            : ((watchedPurchasePrice || 0) - (watchedSalvageValue || 0)).toLocaleString()
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Est. Monthly Depreciation:</span>
                        <p className="font-medium">₱{calculateMonthlyDepreciation().toLocaleString()}</p>
                      </div>
                    </div>
                    {watchedIsPreDepreciated && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        * Calculation based on remaining book value and remaining useful life
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pre-Depreciation Configuration */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-border">
              <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <History className="h-5 w-5" />
                Pre-Depreciation Configuration
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use this section if the asset was already depreciating before being entered into the system
              </p>
            </div>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isPreDepreciated"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked)
                          setIsPreDepreciated(checked)
                          if (!checked) {
                            // Reset pre-depreciation fields when disabled
                            form.setValue("originalPurchaseDate", undefined)
                            form.setValue("originalPurchasePrice", undefined)
                            form.setValue("originalUsefulLifeMonths", undefined)
                            form.setValue("priorDepreciationAmount", 0)
                            form.setValue("priorDepreciationMonths", 0)
                            form.setValue("systemEntryDate", undefined)
                            form.setValue("systemEntryBookValue", undefined)
                            form.setValue("remainingUsefulLifeMonths", undefined)
                            form.setValue("useSystemEntryAsStart", false)
                          } else {
                            // When enabling pre-depreciation, set system entry date to today
                            form.setValue("systemEntryDate", new Date())
                            form.setValue("useSystemEntryAsStart", true)
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-medium">
                      This asset was already depreciating before system entry
                    </FormLabel>
                  </FormItem>
                )}
              />

              {(watchedIsPreDepreciated || isPreDepreciated) && (
                <div className="space-y-6 p-4 border rounded-lg bg-muted/20">
                  {/* Depreciation Method and Salvage Value */}
                  <div>
                    <div className="text-sm font-medium text-foreground mb-3">
                      Depreciation Settings
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="depreciationMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Depreciation Method <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="STRAIGHT_LINE">Straight Line</SelectItem>
                                <SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem>
                                <SelectItem value="UNITS_OF_PRODUCTION">Units of Production</SelectItem>
                                <SelectItem value="SUM_OF_YEARS_DIGITS">Sum of Years Digits</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="salvageValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Salvage Value</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Original Asset Information */}
                  <div>
                    <div className="text-sm font-medium text-foreground mb-3">
                      Original Asset Information
                    </div>
                  
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="originalPurchaseDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Original Purchase Date <span className="text-red-500">*</span></FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick original purchase date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date > new Date()}
                                captionLayout="dropdown"
                                fromYear={new Date().getFullYear() - 5}
                                toYear={new Date().getFullYear() + 5}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="originalPurchasePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Original Purchase Price <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="systemEntryDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>System Entry Date <span className="text-red-500">*</span></FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick system entry date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date > new Date()}
                                captionLayout="dropdown"
                                fromYear={new Date().getFullYear() - 5}
                                toYear={new Date().getFullYear() + 5}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="warrantyExpiry"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Warranty Expiry</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick warranty expiry date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="originalUsefulLifeMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Original Useful Life (Months) <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priorDepreciationAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accumulated Depreciated Amount <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priorDepreciationMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accumulated Depreciated Months <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                    control={form.control}
                    name="systemEntryBookValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remaining Book Value <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>
                  </div>

                  

                  <FormField
                    control={form.control}
                    name="useSystemEntryAsStart"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          Start future depreciation from system entry date (recommended)
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  {/* Pre-depreciation Preview */}
                  {watchedOriginalPurchasePrice && watchedPriorDepreciationAmount && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">Pre-Depreciation Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Original Cost:</span>
                          <p className="font-medium text-blue-900 dark:text-blue-100">₱{watchedOriginalPurchasePrice.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Prior Depreciation:</span>
                          <p className="font-medium text-blue-900 dark:text-blue-100">₱{watchedPriorDepreciationAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Calculated Book Value:</span>
                          <p className="font-medium text-blue-900 dark:text-blue-100">₱{(watchedOriginalPurchasePrice - watchedPriorDepreciationAmount).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-blue-700 dark:text-blue-300">Entry Book Value:</span>
                          <p className="font-medium text-blue-900 dark:text-blue-100">₱{(watchedSystemEntryBookValue || 0).toLocaleString()}</p>
                        </div>
                      </div>
                      {watchedSystemEntryBookValue && Math.abs((watchedOriginalPurchasePrice - watchedPriorDepreciationAmount) - watchedSystemEntryBookValue) > 0.01 && (
                        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ Note: Entry book value differs from calculated book value. This may indicate an adjustment or different depreciation method was used.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Financial Configuration - Moved to bottom */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-border">
              <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Financial Configuration
              </h3>
              {selectedCategory && (
                <p className="text-sm text-muted-foreground mt-1">
                  Default accounts from category: {selectedCategory.name}
                </p>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="assetAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select asset account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assetAccounts.filter(account => account.id && account.id.trim() !== '').map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.accountCode} - {account.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="depreciationExpenseAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Expense Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select expense account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseAccounts.filter(account => account.id && account.id.trim() !== '').map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.accountCode} - {account.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accumulatedDepAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accumulated Depreciation Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select accumulated dep. account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assetAccounts.filter(account => account.id && account.id.trim() !== '').map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.accountCode} - {account.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </form>
      </Form>


    </div>
  )
}