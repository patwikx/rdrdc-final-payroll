"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, DollarSign, Settings, FileText } from "lucide-react"
import { toast } from "sonner"
import { AssetDetailsData, updateAsset } from "@/lib/actions/asset-details-actions"
import { getAssetCategories, getDepartments, getGLAccounts } from "@/lib/actions/create-asset-actions"
import { AssetStatus, DepreciationMethod, AccountType } from "@prisma/client"

interface EditAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: AssetDetailsData
  businessUnitId: string
}

interface AssetCategory {
  id: string
  name: string
  code: string
}

interface Department {
  id: string
  name: string
  code: string | null
  isActive: boolean | null
  businessUnitId: string | null
}

interface GLAccount {
  id: string
  accountCode: string
  accountName: string
  accountType: AccountType
}

interface UpdateAssetData {
  description: string
  serialNumber?: string
  modelNumber?: string
  brand?: string
  categoryId: string
  departmentId?: string
  location?: string
  notes?: string
  purchaseDate?: Date
  purchasePrice?: number
  warrantyExpiry?: Date
  status: AssetStatus
  isActive: boolean
  
  // Depreciation fields
  depreciationMethod?: DepreciationMethod | "none"
  usefulLifeYears?: number
  usefulLifeMonths?: number
  salvageValue?: number
  depreciationStartDate?: Date
  
  // GL Account fields
  assetAccountId?: string
  depreciationExpenseAccountId?: string
  accumulatedDepAccountId?: string
}

export function EditAssetDialog({ 
  open, 
  onOpenChange, 
  asset, 
  businessUnitId 
}: EditAssetDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([])

  const form = useForm<UpdateAssetData>({
    defaultValues: {
      description: asset.description,
      serialNumber: asset.serialNumber || "",
      modelNumber: asset.modelNumber || "",
      brand: asset.brand || "",
      categoryId: asset.category.id,
      departmentId: asset.department?.id || "none",
      location: asset.location || "",
      notes: asset.notes || "",
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : undefined,
      purchasePrice: asset.purchasePrice || undefined,
      warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry) : undefined,
      status: asset.status,
      isActive: asset.isActive,
      depreciationMethod: asset.depreciationMethod || "none",
      usefulLifeYears: asset.usefulLifeYears || undefined,
      usefulLifeMonths: (() => {
        // Handle both old format (years + months) and new format (total months)
        if (asset.usefulLifeMonths && asset.usefulLifeMonths > 12) {
          // New format: total months stored in usefulLifeMonths
          return asset.usefulLifeMonths;
        } else {
          // Old format: years * 12 + additional months
          return (asset.usefulLifeYears || 0) * 12 + (asset.usefulLifeMonths || 0);
        }
      })(),
      salvageValue: asset.salvageValue || undefined,
      depreciationStartDate: asset.depreciationStartDate ? new Date(asset.depreciationStartDate) : undefined,
      assetAccountId: asset.assetAccount?.id || "none",
      depreciationExpenseAccountId: asset.depreciationExpenseAccount?.id || "none",
      accumulatedDepAccountId: asset.accumulatedDepAccount?.id || "none"
    }
  })

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    try {
      const [categoriesData, departmentsData, glAccountsData] = await Promise.all([
        getAssetCategories(businessUnitId),
        getDepartments(businessUnitId, true), // Include inactive departments
        getGLAccounts()
      ])
      
      setCategories(categoriesData)
      setDepartments(departmentsData)
      setGLAccounts(glAccountsData)
      
      // Debug logging
      console.log("Loaded departments:", departmentsData.length, departmentsData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to load form data")
    }
  }

  const onSubmit = async (data: UpdateAssetData) => {
    setIsLoading(true)
    try {
      // Convert "none" values to undefined and handle useful life conversion
      const processedData = {
        ...data,
        departmentId: data.departmentId === "none" ? undefined : data.departmentId,
        assetAccountId: data.assetAccountId === "none" ? undefined : data.assetAccountId,
        depreciationExpenseAccountId: data.depreciationExpenseAccountId === "none" ? undefined : data.depreciationExpenseAccountId,
        accumulatedDepAccountId: data.accumulatedDepAccountId === "none" ? undefined : data.accumulatedDepAccountId,
        depreciationMethod: data.depreciationMethod === "none" ? undefined : data.depreciationMethod,
        // Convert total months back to years and months for backward compatibility
        usefulLifeYears: data.usefulLifeMonths ? Math.floor(data.usefulLifeMonths / 12) : undefined,
        usefulLifeMonths: data.usefulLifeMonths // Keep the total months in this field
      }
      
      const result = await updateAsset(asset.id, processedData, businessUnitId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        onOpenChange(false)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to update asset")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onOpenChange(false)
  }

  const assetAccounts = glAccounts.filter(acc => acc.accountType === 'ASSET')
  const expenseAccounts = glAccounts.filter(acc => acc.accountType === 'EXPENSE')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Asset: {asset.itemCode}
          </DialogTitle>
          <DialogDescription>
            Update asset information, financial configuration, and depreciation settings
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
                <TabsTrigger value="accounts">GL Accounts</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">Basic Information</h3>
                      <p className="text-sm text-muted-foreground">Update basic asset details and identification</p>
                    </div>
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="description"
                        rules={{ required: "Description is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Asset description" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="categoryId"
                        rules={{ required: "Category is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="w-full">
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
                        name="serialNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Serial Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Serial number" {...field} />
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
                              <Input placeholder="Model number" {...field} />
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
                              <Input placeholder="Brand name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        rules={{ required: "Status is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="AVAILABLE">Available</SelectItem>
                                <SelectItem value="DEPLOYED">Deployed</SelectItem>
                                <SelectItem value="IN_MAINTENANCE">In Maintenance</SelectItem>
                                <SelectItem value="RETIRED">Retired</SelectItem>
                                <SelectItem value="LOST">Lost</SelectItem>
                                <SelectItem value="DAMAGED">Damaged</SelectItem>
                                <SelectItem value="FULLY_DEPRECIATED">Fully Depreciated</SelectItem>
                                <SelectItem value="DISPOSED">Disposed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="departmentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No department</SelectItem>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name} {dept.code && `(${dept.code})`}
                                    {!dept.businessUnitId}
                                    {dept.isActive === false && " (Inactive)"}
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
                              <Input placeholder="Asset location" {...field} />
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
                            <Textarea 
                              placeholder="Additional notes about the asset..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Active Status</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Enable this asset for operations
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                </div>
              </TabsContent>

              <TabsContent value="financial" className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">Financial Information</h3>
                      <p className="text-sm text-muted-foreground">Update purchase information and warranty details</p>
                    </div>
                  </div>
                    <div className="grid grid-cols-2 gap-4">
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
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="purchaseDate"
                        render={({ field }) => (
                          <FormItem>
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
                                  disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                  }
                                  initialFocus
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
                          <FormItem>
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
                                  disabled={(date) => date < new Date("1900-01-01")}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                </div>
              </TabsContent>

              <TabsContent value="depreciation" className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">Depreciation Configuration</h3>
                      <p className="text-sm text-muted-foreground">Configure depreciation method and useful life</p>
                    </div>
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="depreciationMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Depreciation Method</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No depreciation</SelectItem>
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
                                placeholder="0.00" 
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              />
                            </FormControl>
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
                                onChange={(e) => {
                                  const months = e.target.value ? parseInt(e.target.value) : undefined;
                                  field.onChange(months);
                                  // Auto-calculate years for backward compatibility
                                  if (months) {
                                    const years = Math.floor(months / 12);
                                    const remainingMonths = months % 12;
                                    form.setValue("usefulLifeYears", years);
                                    // Update the months field to only store remaining months
                                    setTimeout(() => {
                                      field.onChange(months); // Keep total months in this field
                                    }, 0);
                                  } else {
                                    form.setValue("usefulLifeYears", undefined);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                            <div className="text-xs text-muted-foreground">
                              {field.value && field.value > 0 && (
                                <span>
                                  {Math.floor(field.value / 12)} years, {field.value % 12} months
                                </span>
                              )}
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="depreciationStartDate"
                        render={({ field }) => (
                          <FormItem>
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
                                  disabled={(date) => date < new Date("1900-01-01")}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                </div>
              </TabsContent>

              <TabsContent value="accounts" className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">GL Account Configuration</h3>
                      <p className="text-sm text-muted-foreground">Configure general ledger accounts for this asset</p>
                    </div>
                  </div>
                    <FormField
                      control={form.control}
                      name="assetAccountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset Account</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select asset account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No account selected</SelectItem>
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
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select depreciation expense account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No account selected</SelectItem>
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
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select accumulated depreciation account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No account selected</SelectItem>
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
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}