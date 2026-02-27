"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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

import { Package, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { 
  updateAssetCategory, 
  getGLAccountsForCategories,
  AssetCategoryData,
  AssetCategoryWithDetails
} from "@/lib/actions/asset-categories-actions"
import { AccountType } from "@prisma/client"

interface EditCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: AssetCategoryWithDetails
  businessUnitId: string
}

interface GLAccount {
  id: string
  accountCode: string
  accountName: string
  accountType: AccountType
}

export function EditCategoryDialog({ 
  open, 
  onOpenChange, 
  category, 
  businessUnitId 
}: EditCategoryDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([])

  const form = useForm<AssetCategoryData>({
    defaultValues: {
      name: category.name,
      code: category.code,
      description: category.description || "",
      defaultAssetAccountId: category.defaultAssetAccountId || "none",
      defaultDepreciationExpenseAccountId: category.defaultDepreciationExpenseAccountId || "none",
      defaultAccumulatedDepAccountId: category.defaultAccumulatedDepAccountId || "none",
      isActive: category.isActive
    }
  })

  // Load GL accounts
  useEffect(() => {
    if (open) {
      loadGLAccounts()
      // Reset form with category data when dialog opens
      form.reset({
        name: category.name,
        code: category.code,
        description: category.description || "",
        defaultAssetAccountId: category.defaultAssetAccountId || "none",
        defaultDepreciationExpenseAccountId: category.defaultDepreciationExpenseAccountId || "none",
        defaultAccumulatedDepAccountId: category.defaultAccumulatedDepAccountId || "none",
        isActive: category.isActive
      })
    }
  }, [open, category, form])

  const loadGLAccounts = async () => {
    try {
      const accounts = await getGLAccountsForCategories()
      setGLAccounts(accounts)
    } catch (error) {
      console.error("Error loading GL accounts:", error)
      toast.error("Failed to load GL accounts")
    }
  }

  const onSubmit = async (data: AssetCategoryData) => {
    setIsLoading(true)
    try {
      // Convert "none" values to undefined
      const processedData = {
        ...data,
        defaultAssetAccountId: data.defaultAssetAccountId === "none" ? undefined : data.defaultAssetAccountId,
        defaultDepreciationExpenseAccountId: data.defaultDepreciationExpenseAccountId === "none" ? undefined : data.defaultDepreciationExpenseAccountId,
        defaultAccumulatedDepAccountId: data.defaultAccumulatedDepAccountId === "none" ? undefined : data.defaultAccumulatedDepAccountId
      }
      
      const result = await updateAssetCategory(category.id, processedData, businessUnitId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        onOpenChange(false)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to update category")
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Category: {category.name}
          </DialogTitle>
          <DialogDescription>
            Update category information and default account configurations
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Basic Information</h3>
                  <p className="text-sm text-muted-foreground">Category name and identification details</p>
                </div>
              </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    rules={{ required: "Category name is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Name <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Computer Equipment" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="code"
                    rules={{ 
                      required: "Category code is required",
                      pattern: {
                        value: /^[A-Z0-9]+$/,
                        message: "Code must contain only uppercase letters and numbers"
                      }
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Code <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., COMP" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of this category..."
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
                          Enable this category for new assets
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

            {/* Default GL Accounts */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Default GL Accounts (Optional)</h3>
                  <p className="text-sm text-muted-foreground">Set default accounts for assets in this category. These can be overridden per asset.</p>
                </div>
              </div>
                <FormField
                  control={form.control}
                  name="defaultAssetAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Asset Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No default account</SelectItem>
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
                  name="defaultDepreciationExpenseAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Depreciation Expense Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select depreciation expense account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No default account</SelectItem>
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
                  name="defaultAccumulatedDepAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Accumulated Depreciation Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select accumulated depreciation account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No default account</SelectItem>
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

            {/* Category Stats */}
            {category._count.assets > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Category Usage</h4>
                </div>
                <div className="text-sm text-muted-foreground">
                  This category is currently used by <strong>{category._count.assets}</strong> asset(s).
                  Changes to default accounts will only affect new assets created in this category.
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}