"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { 
  createAssetCategory, 
  getGLAccountsForCategories,
  AssetCategoryData 
} from "@/lib/actions/asset-categories-actions"
import { AccountType } from "@prisma/client"

interface CreateCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessUnitId: string
}

interface GLAccount {
  id: string
  accountCode: string
  accountName: string
  accountType: AccountType
}

export function CreateCategoryDialog({ open, onOpenChange, businessUnitId }: CreateCategoryDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([])

  const form = useForm<AssetCategoryData>({
    defaultValues: {
      name: "",
      code: "",
      description: "",
      defaultAssetAccountId: "",
      defaultDepreciationExpenseAccountId: "",
      defaultAccumulatedDepAccountId: "",
      isActive: true
    }
  })

  const watchedName = form.watch("name")

  // Auto-generate code from name
  useEffect(() => {
    if (watchedName && !form.getValues("code")) {
      const generatedCode = watchedName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 6)
      form.setValue("code", generatedCode)
    }
  }, [watchedName, form])

  // Load GL accounts
  useEffect(() => {
    if (open) {
      loadGLAccounts()
    }
  }, [open])

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
      
      const result = await createAssetCategory(processedData, businessUnitId)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        form.reset()
        onOpenChange(false)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to create category")
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
            Create New Category
          </DialogTitle>
          <DialogDescription>
            Add a new asset category with default account configurations
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Basic Information</CardTitle>
                <CardDescription>
                  Category name and identification details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            {/* Default GL Accounts */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Default GL Accounts (Optional)
                </CardTitle>
                <CardDescription>
                  Set default accounts for assets in this category. These can be overridden per asset.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}