"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { 
  Send,
  CalendarIcon,
  Users,
  Package,
  FileText,
  Loader2
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { AssetWithDetails } from "@/lib/actions/asset-management-actions"
import { deployAssets, getEmployees } from "@/lib/actions/asset-deployment-actions"
import { toast } from "sonner"

const deploymentSchema = z.object({
  employeeId: z.string().min(1, "Please select an employee"),
  deployedDate: z.date({
    message: "Deployment date is required",
  }),
  expectedReturnDate: z.date().optional(),
  deploymentNotes: z.string().optional(),
})

type DeploymentFormData = z.infer<typeof deploymentSchema>

interface AssetDeploymentDialogProps {
  assets: AssetWithDetails[]
  businessUnitId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface Employee {
  id: string
  name: string
  employeeId: string
  email: string | null
  department: {
    id: string
    name: string
  } | null
}

export function AssetDeploymentDialog({ 
  assets, 
  businessUnitId, 
  open, 
  onOpenChange,
  onSuccess 
}: AssetDeploymentDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)

  const form = useForm<DeploymentFormData>({
    resolver: zodResolver(deploymentSchema),
    defaultValues: {
      deployedDate: new Date(),
    },
  })

  // Load employees when dialog opens
  useEffect(() => {
    if (open) {
      loadEmployees()
    }
  }, [open, businessUnitId])

  const loadEmployees = async () => {
    setIsLoadingEmployees(true)
    try {
      const employeeData = await getEmployees(businessUnitId)
      setEmployees(employeeData)
    } catch (error) {
      console.error("Error loading employees:", error)
      toast.error("Failed to load employees")
    } finally {
      setIsLoadingEmployees(false)
    }
  }

  const onSubmit = async (data: DeploymentFormData) => {
    setIsLoading(true)
    try {
      const assetIds = assets.map(asset => asset.id)
      
      const result = await deployAssets({
        assetIds,
        employeeId: data.employeeId,
        deployedDate: data.deployedDate,
        expectedReturnDate: data.expectedReturnDate,
        deploymentNotes: data.deploymentNotes,
        businessUnitId
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        onSuccess()
      }
    } catch (error) {
      console.error("Error deploying assets:", error)
      toast.error("Failed to deploy assets")
    } finally {
      setIsLoading(false)
    }
  }

  const totalValue = assets.reduce((sum, asset) => {
    return sum + (asset.purchasePrice || 0)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Deploy Assets
          </DialogTitle>
          <DialogDescription>
            Deploy {assets.length} selected assets to an employee under a transmittal batch
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* Selected Assets Summary */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Selected Assets ({assets.length})
              </h3>
              <Badge variant="outline">
                Total Value: {new Intl.NumberFormat('en-PH', { 
                  style: 'currency', 
                  currency: 'PHP' 
                }).format(totalValue)}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {assets.map((asset) => (
                <div key={asset.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="font-mono text-xs">
                    {asset.itemCode}
                  </Badge>
                  <span className="truncate">{asset.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deployment Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Employee Selection */}
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Deploy To Employee
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isLoadingEmployees}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            isLoadingEmployees ? "Loading employees..." : "Select an employee"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{employee.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ID: {employee.employeeId}
                                {employee.department && ` • ${employee.department.name}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Deployment Date */}
              <FormField
                control={form.control}
                name="deployedDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Deployment Date</FormLabel>
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

              {/* Expected Return Date */}
              <FormField
                control={form.control}
                name="expectedReturnDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expected Return Date (Optional)</FormLabel>
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
                            date < new Date()
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Deployment Notes */}
              <FormField
                control={form.control}
                name="deploymentNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Deployment Notes (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional notes about this deployment..."
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
            A transmittal batch will be automatically generated (e.g., BU-202411-001-01, BU-202411-001-02...)
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
                  Deploying...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Deploy Assets
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}