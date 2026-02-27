"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useForm, useFieldArray } from "react-hook-form"
import { CalendarIcon, Plus, Trash2, Save, X, Send, Check, ChevronsUpDown } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { updateMaterialRequest, submitForApproval } from "@/lib/actions/mrs-actions/material-request-actions"
import { getBusinessUnits, getDepartments } from "@/lib/actions/mrs-actions/user-actions"
import { MaterialRequest } from "@/types/material-request-types"

interface BldgCodeItem {
  itemId: string
  itemCode: string
  itemDesc: string
  buyUnitMsr: string | null
  purPackMsr: string | null
  cost: number
}

interface MaterialRequestItem {
  itemCode?: string
  description: string
  uom: string
  quantity: number
  unitPrice?: number
  remarks?: string
  isNew: boolean
}

interface MaterialRequestFormData {
  type: "ITEM" | "SERVICE"
  datePrepared: Date
  dateRequired: Date
  businessUnitId: string
  departmentId?: string
  chargeTo?: string
  bldgCode?: string
  purpose?: string
  remarks?: string
  deliverTo?: string
  freight: number
  discount: number
  items: MaterialRequestItem[]
}

interface MaterialRequestEditFormProps {
  materialRequest: MaterialRequest
  onSuccess: () => void
  onCancel: () => void
}

export function MaterialRequestEditForm({ 
  materialRequest, 
  onSuccess, 
  onCancel 
}: MaterialRequestEditFormProps) {
  useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [businessUnits, setBusinessUnits] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string | null; businessUnitId: string | null }>>([])
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [bldgCodeItems, setBldgCodeItems] = useState<BldgCodeItem[]>([])
  const [isLoadingBldgCodes, setIsLoadingBldgCodes] = useState(false)
  const [bldgCodeSearch, setBldgCodeSearch] = useState("")
  const [bldgCodeOpen, setBldgCodeOpen] = useState(false)

  const form = useForm<MaterialRequestFormData>({
    defaultValues: {
      type: materialRequest.type,
      datePrepared: new Date(materialRequest.datePrepared),
      dateRequired: new Date(materialRequest.dateRequired),
      businessUnitId: materialRequest.businessUnitId,
      departmentId: materialRequest.departmentId || "",
      chargeTo: materialRequest.chargeTo || "",
      bldgCode: materialRequest.bldgCode || "",
      purpose: materialRequest.purpose || "",
      remarks: materialRequest.remarks || "",
      deliverTo: materialRequest.deliverTo || "",
      freight: materialRequest.freight,
      discount: materialRequest.discount,
      items: materialRequest.items.map(item => ({
        itemCode: item.itemCode || "",
        description: item.description,
        uom: item.uom,
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        remarks: item.remarks || "",
        isNew: !item.itemCode,
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchedBusinessUnitId = form.watch("businessUnitId")
  const watchedItems = form.watch("items")
  const watchedFreight = form.watch("freight")
  const watchedDiscount = form.watch("discount")

  // Calculate total
  const total = watchedItems.reduce((sum, item) => {
    const itemTotal = (item.unitPrice || 0) * (item.quantity || 0)
    return sum + itemTotal
  }, 0) + (watchedFreight || 0) - (watchedDiscount || 0)

  useEffect(() => {
    const loadData = async () => {
      const [businessUnitsData, departmentsData] = await Promise.all([
        getBusinessUnits(),
        getDepartments(),
      ])
      setBusinessUnits(businessUnitsData)
      setDepartments(departmentsData)
    }
    loadData()
  }, [])

  // Load bldg codes
  useEffect(() => {
    const loadBldgCodes = async () => {
      setIsLoadingBldgCodes(true)
      try {
        const response = await fetch(`/api/bldg-code?search=${encodeURIComponent(bldgCodeSearch)}`)
        const data = await response.json()
        if (data.success) {
          setBldgCodeItems(data.data)
        }
      } catch (error) {
        console.error("Error loading bldg codes:", error)
      } finally {
        setIsLoadingBldgCodes(false)
      }
    }
    
    const debounceTimer = setTimeout(() => {
      loadBldgCodes()
    }, 300)
    
    return () => clearTimeout(debounceTimer)
  }, [bldgCodeSearch])

  const filteredDepartments = departments.filter(
    dept => dept.businessUnitId === watchedBusinessUnitId
  )

  const onSubmit = async (data: MaterialRequestFormData) => {
    if (data.items.length === 0) {
      toast.error("Please add at least one item")
      return
    }

    setIsLoading(true)
    try {
      const result = await updateMaterialRequest({
        id: materialRequest.id,
        ...data,
      })

      if (result.success) {
        toast.success("Material request updated successfully")
        onSuccess()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error updating material request:", error)
      toast.error("Failed to update material request")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitForApproval = async () => {
    const formData = form.getValues()
    
    if (formData.items.length === 0) {
      toast.error("Please add at least one item")
      return
    }

    setIsLoading(true)
    try {
      // First update the request
      const updateResult = await updateMaterialRequest({
        id: materialRequest.id,
        ...formData,
      })

      if (updateResult.success) {
        // Then submit for approval
        const submitResult = await submitForApproval(materialRequest.id)
        
        if (submitResult.success) {
          toast.success("Material request updated and submitted for approval successfully")
          onSuccess()
        } else {
          toast.error(submitResult.message)
        }
      } else {
        toast.error(updateResult.message)
      }
    } catch (error) {
      console.error("Error submitting for approval:", error)
      toast.error("Failed to submit material request for approval")
    } finally {
      setIsLoading(false)
    }
  }

  // Add Item Dialog Form
  const addItemForm = useForm<MaterialRequestItem>({
    defaultValues: {
      itemCode: "",
      description: "",
      uom: "",
      quantity: 1,
      unitPrice: 0,
      remarks: "",
      isNew: true,
    },
    mode: "onChange", // Enable real-time validation
  })

  const watchedIsNew = addItemForm.watch("isNew")

  const addItem = (data: MaterialRequestItem) => {
    if (!data.isNew && !data.itemCode) {
      toast.error("Item code is required for existing items")
      return
    }
    
    if (!data.description || data.description.trim() === "") {
      toast.error("Description is required")
      return
    }
    
    if (!data.uom || data.uom.trim() === "") {
      toast.error("Unit of measurement is required")
      return
    }
    
    if (!data.quantity || data.quantity <= 0) {
      toast.error("Quantity must be greater than 0")
      return
    }
    
    append(data)
    addItemForm.reset({
      itemCode: "",
      description: "",
      uom: "",
      quantity: 1,
      unitPrice: 0,
      remarks: "",
      isNew: true,
    })
    setIsAddItemDialogOpen(false)
    toast.success("Item added successfully")
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="gap-2 w-full sm:w-auto"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2 w-full sm:w-auto">
              <Save className="h-4 w-4" />
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
            <Button 
              type="button" 
              onClick={handleSubmitForApproval}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 gap-2 w-full sm:w-auto"
            >
              <Send className="h-4 w-4" />
              {isLoading ? "Submitting..." : "Submit for Approval"}
            </Button>
          </div>

          {/* Basic Information */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ITEM">Item</SelectItem>
                          <SelectItem value="SERVICE">Service</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessUnitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Business Unit</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue placeholder="Select BU" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {businessUnits.map((bu) => (
                            <SelectItem key={bu.id} value={bu.id}>
                              {bu.name}
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
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue placeholder="Select dept" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no-department">No Department</SelectItem>
                          {filteredDepartments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <FormField
                  control={form.control}
                  name="chargeTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Charge To</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter charge to" className="h-9 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bldgCode"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-xs">Bldg Code</FormLabel>
                      <div className="flex gap-2">
                        <Popover open={bldgCodeOpen} onOpenChange={setBldgCodeOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={bldgCodeOpen}
                              type="button"
                              className={cn(
                                "w-[140px] justify-between h-9 text-sm",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              Select
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search bldg code..." 
                                value={bldgCodeSearch}
                                onValueChange={setBldgCodeSearch}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {isLoadingBldgCodes ? "Loading..." : "No bldg code found."}
                                </CommandEmpty>
                                <CommandGroup>
                                  {bldgCodeItems.map((item) => (
                                    <CommandItem
                                      key={item.itemId}
                                      value={item.itemCode}
                                      onSelect={() => {
                                        form.setValue("bldgCode", item.itemCode)
                                        setBldgCodeOpen(false)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === item.itemCode ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{item.itemCode}</span>
                                        <span className="text-xs text-muted-foreground truncate">
                                          {item.itemDesc}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormControl>
                          <Input
                            placeholder="Or enter manually"
                            className="h-9 text-sm flex-1"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="datePrepared"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-xs">Date Prepared</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal h-9 text-sm",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MMM dd, yyyy")
                              ) : (
                                <span>Pick date</span>
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
                              date < new Date("1900-01-01")
                            }
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-xs">Date Required</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal h-9 text-sm",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MMM dd, yyyy")
                              ) : (
                                <span>Pick date</span>
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
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Purpose</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter purpose"
                          className="resize-none h-20 text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deliverTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Deliver To</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter delivery address"
                          className="resize-none h-20 text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Remarks</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter remarks"
                          className="resize-none h-20 text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-sm font-semibold">Items</CardTitle>
                <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Item</DialogTitle>
                    </DialogHeader>
                    <Form {...addItemForm}>
                      <form onSubmit={addItemForm.handleSubmit(addItem)} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={addItemForm.control}
                            name="isNew"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Item Type</FormLabel>
                                <Select 
                                  onValueChange={(value) => field.onChange(value === "true")} 
                                  defaultValue={field.value ? "true" : "false"}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select item type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="true">New Item</SelectItem>
                                    <SelectItem value="false">Existing Item</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={addItemForm.control}
                            name="itemCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Item Code {!watchedIsNew && "*"}</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Enter item code" 
                                    {...field} 
                                    disabled={watchedIsNew}
                                    className={watchedIsNew ? "bg-muted" : ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={addItemForm.control}
                            name="uom"
                            rules={{
                              required: "Unit of measurement is required",
                              minLength: {
                                value: 1,
                                message: "Unit of measurement cannot be empty"
                              }
                            }}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit of Measurement *</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., pcs, kg, liter" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={addItemForm.control}
                            name="quantity"
                            rules={{
                              required: "Quantity is required",
                              min: {
                                value: 0.01,
                                message: "Quantity must be greater than 0"
                              }
                            }}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="0"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={addItemForm.control}
                          name="unitPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit Price (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
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
                          control={addItemForm.control}
                          name="description"
                          rules={{
                            required: "Description is required",
                            minLength: {
                              value: 1,
                              message: "Description cannot be empty"
                            }
                          }}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description *</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Enter item description"
                                  className="resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={addItemForm.control}
                          name="remarks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Remarks (Optional)</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Enter item remarks"
                                  className="resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <DialogFooter className="flex-col sm:flex-row gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsAddItemDialogOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button type="submit" className="w-full sm:w-auto">Add Item</Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0 ml-4 mr-4">
              {fields.length > 0 ? (
                <div>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden">
                    <div className="space-y-3 p-4">
                      {fields.map((field, index) => {
                        const item = watchedItems[index]
                        const itemTotal = (item?.unitPrice || 0) * (item?.quantity || 0)
                        return (
                          <div key={field.id} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                                  {index + 1}
                                </div>
                                <Badge 
                                  variant={item?.isNew ? "default" : "secondary"}
                                  className="font-medium text-xs"
                                >
                                  {item?.isNew ? "New" : "Existing"}
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="space-y-2">
                              <div>
                                <div className="text-xs text-muted-foreground">Item Code</div>
                                <div className="font-medium text-sm">
                                  {item?.itemCode || (
                                    <span className="text-muted-foreground italic">Auto-generated</span>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-xs text-muted-foreground">Description</div>
                                <div className="font-medium text-sm">{item?.description}</div>
                                {item?.remarks && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {item.remarks}
                                  </div>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs text-muted-foreground">UOM</div>
                                  <div className="font-medium text-sm">{item?.uom}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Quantity</div>
                                  <div className="font-medium text-sm">{item?.quantity}</div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs text-muted-foreground">Unit Price</div>
                                  <div className="font-medium text-sm">₱{(item?.unitPrice || 0).toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Total</div>
                                  <div className="font-semibold text-sm">₱{itemTotal.toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-hidden">
                    <div className="rounded-lg border border-border bg-card overflow-x-auto">
                      <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="border-b border-border hover:bg-transparent">
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                            #
                          </TableHead>
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                            Item Code
                          </TableHead>
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                            Description
                          </TableHead>
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                            UOM
                          </TableHead>
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                            Quantity
                          </TableHead>
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                            Unit Price
                          </TableHead>
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                            Total
                          </TableHead>
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">
                            Type
                          </TableHead>
                          <TableHead className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground w-[100px]">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => {
                        const item = watchedItems[index]
                        const itemTotal = (item?.unitPrice || 0) * (item?.quantity || 0)
                        return (
                          <TableRow 
                            key={field.id} 
                            className="border-b border-border hover:bg-muted/50 transition-colors"
                          >
                            <TableCell className="h-14 px-4 align-middle">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                                {index + 1}
                              </div>
                            </TableCell>
                            <TableCell className="h-14 px-4 align-middle">
                              <div className="font-medium">
                                {item?.itemCode || (
                                  <span className="text-muted-foreground italic">Auto-generated</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="h-14 px-4 align-middle">
                              <div className="max-w-[200px]">
                                <div className="font-medium truncate">{item?.description}</div>
                                {item?.remarks && (
                                  <div className="text-xs text-muted-foreground truncate mt-1">
                                    {item.remarks}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="h-14 px-4 align-middle">
                              <span className="font-medium">{item?.uom}</span>
                            </TableCell>
                            <TableCell className="h-14 px-4 align-middle">
                              <span className="font-medium">{item?.quantity}</span>
                            </TableCell>
                            <TableCell className="h-14 px-4 align-middle">
                              <span className="font-medium">₱{(item?.unitPrice || 0).toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="h-14 px-4 align-middle">
                              <span className="font-semibold">₱{itemTotal.toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="h-14 px-4 align-middle">
                              <Badge 
                                variant={item?.isNew ? "default" : "secondary"}
                                className="font-medium"
                              >
                                {item?.isNew ? "New" : "Existing"}
                              </Badge>
                            </TableCell>
                            <TableCell className="h-14 px-4 align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Plus className="h-6 w-6" />
                    </div>
                    <p className="font-medium">No items added yet</p>
                    <p className="text-sm">Click &quot;Add Item&quot; to get started</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <FormField
                  control={form.control}
                  name="freight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Freight</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
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
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-end sm:col-span-2 lg:col-span-1">
                  <div className="text-base sm:text-lg font-semibold w-full">
                    <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
                    <div className="text-lg sm:text-xl">₱{total.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  )
}