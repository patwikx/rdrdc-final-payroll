"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { 
  Undo2,
  CalendarIcon,
  Package,
  FileText,
  Loader2,
  User,
  AlertTriangle
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DeployedAssetData, returnAssets } from "@/lib/actions/asset-return-actions"
import { toast } from "sonner"

const returnSchema = z.object({
  returnedDate: z.date({
    message: "Return date is required",
  }),
  returnNotes: z.string().optional(),
})

type ReturnFormData = z.infer<typeof returnSchema>

interface AssetReturnDialogProps {
  assets: DeployedAssetData[]
  businessUnitId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AssetReturnDialog({ 
  assets, 
  businessUnitId, 
  open, 
  onOpenChange,
  onSuccess 
}: AssetReturnDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ReturnFormData>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      returnedDate: new Date(),
    },
  })

  const onSubmit = async (data: ReturnFormData) => {
    setIsLoading(true)
    try {
      const assetIds = assets.map(asset => asset.id)
      
      const result = await returnAssets({
        assetIds,
        returnedDate: data.returnedDate,
        returnNotes: data.returnNotes,
        businessUnitId
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        onSuccess()
      }
    } catch (error) {
      console.error("Error returning assets:", error)
      toast.error("Failed to return assets")
    } finally {
      setIsLoading(false)
    }
  }

  const totalValue = assets.reduce((sum, asset) => {
    return sum + (asset.purchasePrice || 0)
  }, 0)

  // Group assets by employee
  const assetsByEmployee = assets.reduce((acc, asset) => {
    const employeeId = asset.currentDeployment.employee.id
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: asset.currentDeployment.employee,
        assets: []
      }
    }
    acc[employeeId].assets.push(asset)
    return acc
  }, {} as Record<string, { employee: any, assets: DeployedAssetData[] }>)

  const overdueAssets = assets.filter(asset => 
    asset.currentDeployment.expectedReturnDate && 
    new Date(asset.currentDeployment.expectedReturnDate) < new Date()
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Return Assets
          </DialogTitle>
          <DialogDescription>
            Process the return of {assets.length} deployed assets
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* Overdue Warning */}
          {overdueAssets.length > 0 && (
            <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Overdue Assets</span>
              </div>
              <p className="text-sm text-destructive/80">
                {overdueAssets.length} of the selected assets are overdue for return.
              </p>
            </div>
          )}

          {/* Assets by Employee */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Assets to Return ({assets.length})
            </h3>
            
            {Object.values(assetsByEmployee).map(({ employee, assets: employeeAssets }) => (
              <div key={employee.id} className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{employee.name}</span>
                    <Badge variant="outline" className="text-xs">
                      ID: {employee.employeeId}
                    </Badge>
                    {employee.department && (
                      <Badge variant="secondary" className="text-xs">
                        {employee.department.name}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline">
                    {employeeAssets.length} assets
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {employeeAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center gap-2 text-sm bg-card border rounded p-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {asset.itemCode}
                      </Badge>
                      <span className="truncate">{asset.description}</span>
                      {asset.currentDeployment.expectedReturnDate && 
                       new Date(asset.currentDeployment.expectedReturnDate) < new Date() && (
                        <Badge variant="destructive" className="text-xs">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total Asset Value</span>
              <Badge variant="outline">
                {new Intl.NumberFormat('en-PH', { 
                  style: 'currency', 
                  currency: 'PHP' 
                }).format(totalValue)}
              </Badge>
            </div>
          </div>

          {/* Return Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Return Date */}
              <FormField
                control={form.control}
                name="returnedDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Return Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
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

              {/* Return Notes */}
              <FormField
                control={form.control}
                name="returnNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Return Notes (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any notes about the asset return (condition, damages, etc.)..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Assets will be marked as available after return
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Return Assets
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}