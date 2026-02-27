"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { CalendarIcon, Plus, Trash2, Send, Check, ChevronsUpDown } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { MultiSelectItemsDialog } from "./multi-select-items-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { MRSRequestStatus } from "@prisma/client"
import { createMaterialRequest, submitForApproval, getNextDocumentNumber } from "@/lib/actions/mrs-actions/material-request-actions"
import { getBusinessUnits, getDepartments, getRecommendingApprovers, getFinalApprovers } from "@/lib/actions/mrs-actions/user-actions"
import { REQUEST_STATUS_COLORS, REQUEST_STATUS_LABELS } from "@/types/material-request-types"

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
  docNo: string
  series: "PO" | "JO"
  type: "ITEM" | "SERVICE"
  status: "DRAFT"
  datePrepared: Date
  dateRequired: Date
  businessUnitId: string
  departmentId?: string
  recApproverId?: string
  finalApproverId?: string
  chargeTo?: string
  bldgCode?: string
  purpose?: string
  remarks?: string
  deliverTo?: string
  freight: number
  discount: number
  isStoreUse: boolean
  items: MaterialRequestItem[]
}

export function MaterialRequestCreateForm() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const businessUnitId = params.businessUnitId as string
  const [isLoading, setIsLoading] = useState(false)
  const [businessUnits, setBusinessUnits] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string | null; businessUnitId: string | null }>>([])
  const [recommendingApprovers, setRecommendingApprovers] = useState<Array<{ id: string; name: string; email: string | null; employeeId: string; role: string }>>([])
  const [finalApprovers, setFinalApprovers] = useState<Array<{ id: string; name: string; email: string | null; employeeId: string; role: string }>>([])
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [isMultiSelectDialogOpen, setIsMultiSelectDialogOpen] = useState(false)
  const [, setNextDocNumber] = useState("")
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true)
  const [bldgCodeItems, setBldgCodeItems] = useState<BldgCodeItem[]>([])
  const [isLoadingBldgCodes, setIsLoadingBldgCodes] = useState(false)
  const [bldgCodeSearch, setBldgCodeSearch] = useState("")
  const [bldgCodeOpen, setBldgCodeOpen] = useState(false)

  const form = useForm<MaterialRequestFormData>({
    defaultValues: {
      docNo: "",
      series: "PO",
      type: "ITEM",
      status: "DRAFT",
      datePrepared: new Date(),
      dateRequired: new Date(),
      businessUnitId: businessUnitId || "",
      departmentId: "",
      recApproverId: "",
      finalApproverId: "",
      chargeTo: "",
      bldgCode: "",
      purpose: "",
      remarks: "",
      deliverTo: "",
      freight: 0,
      discount: 0,
      isStoreUse: false,
      items: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchedDepartmentId = form.watch("departmentId")
  const watchedItems = form.watch("items")
  const watchedFreight = form.watch("freight")
  const watchedDiscount = form.watch("discount")
  const watchedSeries = form.watch("series")
  const watchedStatus = form.watch("status")

  // Update document number when series changes
  useEffect(() => {
    const updateDocNumber = async () => {
      try {
        const newDocNo = await getNextDocumentNumber(watchedSeries)
        setNextDocNumber(newDocNo)
        form.setValue("docNo", newDocNo)
      } catch (error) {
        console.error("Error getting next document number:", error)
      }
    }
    updateDocNumber()
  }, [watchedSeries, form])

  // Calculate total
  const total = watchedItems.reduce((sum, item) => {
    const itemTotal = (item.unitPrice || 0) * (item.quantity || 0)
    return sum + itemTotal
  }, 0) + (watchedFreight || 0) - (watchedDiscount || 0)

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingDepartments(true)
      try {
        const [businessUnitsData, departmentsData, initialDocNo] = await Promise.all([
          getBusinessUnits(),
          getDepartments(),
          getNextDocumentNumber("PO")
        ])
        setBusinessUnits(businessUnitsData)
        setDepartments(departmentsData)
        setNextDocNumber(initialDocNo)
        form.setValue("docNo", initialDocNo)
      } catch (error) {
        console.error("Error loading departments:", error)
        toast.error("Failed to load departments")
      } finally {
        setIsLoadingDepartments(false)
      }
    }
    loadData()
  }, [form])

  // Filter departments to show only those belonging to current business unit or with no business unit
  const filteredDepartments = departments.filter(dept => 
    dept.businessUnitId === businessUnitId || dept.businessUnitId === null
  )

  // Auto-populate charge to when department changes
  useEffect(() => {
    if (watchedDepartmentId) {
      const selectedDepartment = departments.find(dept => dept.id === watchedDepartmentId)
      if (selectedDepartment) {
        form.setValue("chargeTo", selectedDepartment.name)
      }
    } else {
      form.setValue("chargeTo", "")
    }
  }, [watchedDepartmentId, departments, form])

  // Load approvers when department changes
  useEffect(() => {
    const loadApprovers = async () => {
      if (watchedDepartmentId) {
        const [recApproversData, finalApproversData] = await Promise.all([
          getRecommendingApprovers(watchedDepartmentId, businessUnitId),
          getFinalApprovers(watchedDepartmentId, businessUnitId)
        ])
        setRecommendingApprovers(recApproversData)
        setFinalApprovers(finalApproversData)
        // Reset approver selection when department changes
        form.setValue("recApproverId", "")
        form.setValue("finalApproverId", "")
      } else {
        setRecommendingApprovers([])
        setFinalApprovers([])
        form.setValue("recApproverId", "")
        form.setValue("finalApproverId", "")
      }
    }
    loadApprovers()
  }, [watchedDepartmentId, form])

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

  const onSubmit = async (data: MaterialRequestFormData) => {

    
    if (data.items.length === 0) {
      toast.error("Please add at least one item")
      return
    }

    if (!data.departmentId) {
      toast.error("Please select a department to charge to")
      return
    }

    if ((!data.recApproverId || data.recApproverId === "no-approvers") && recommendingApprovers.length > 0) {
      toast.error("Please select a recommending approver")
      return
    }

    if ((!data.finalApproverId || data.finalApproverId === "no-approvers") && finalApprovers.length > 0) {
      toast.error("Please select a final approver")
      return
    }

    if (recommendingApprovers.length === 0 && finalApprovers.length === 0) {
      toast.error("Selected department has no approvers configured. Please contact your administrator.")
      return
    }

    if (!data.chargeTo || data.chargeTo.trim() === "") {
      toast.error("Please select a department to charge to")
      return
    }

    // Ensure dates are properly formatted as Date objects
    const formattedData = {
      ...data,
      datePrepared: data.datePrepared instanceof Date ? data.datePrepared : new Date(data.datePrepared),
      dateRequired: data.dateRequired instanceof Date ? data.dateRequired : new Date(data.dateRequired),
    }

    // Debug: Log the data being submitted
    console.log("Submitting data:", JSON.stringify(formattedData, null, 2))

    setIsLoading(true)
    try {
      const result = await createMaterialRequest(formattedData)

      if (result.success) {
        toast.success("Material request saved as draft successfully")
        router.push("../material-requests")
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error submitting form:", error)
      if (error instanceof Error) {
        toast.error(error.message || "Failed to create material request")
      } else {
        toast.error("Failed to create material request")
      }
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

    if (!formData.departmentId) {
      toast.error("Please select a department to charge to")
      return
    }

    if ((!formData.recApproverId || formData.recApproverId === "no-approvers") && recommendingApprovers.length > 0) {
      toast.error("Please select a recommending approver")
      return
    }

    if ((!formData.finalApproverId || formData.finalApproverId === "no-approvers") && finalApprovers.length > 0) {
      toast.error("Please select a final approver")
      return
    }

    if (recommendingApprovers.length === 0 && finalApprovers.length === 0) {
      toast.error("Selected department has no approvers configured. Please contact your administrator.")
      return
    }

    if (!formData.chargeTo || formData.chargeTo.trim() === "") {
      toast.error("Please select a department to charge to")
      return
    }

    // Ensure dates are properly formatted as Date objects
    const formattedData = {
      ...formData,
      datePrepared: formData.datePrepared instanceof Date ? formData.datePrepared : new Date(formData.datePrepared),
      dateRequired: formData.dateRequired instanceof Date ? formData.dateRequired : new Date(formData.dateRequired),
    }

    setIsLoading(true)
    try {
      // First create the request as draft
      const createResult = await createMaterialRequest(formattedData)

      if (createResult.success && createResult.data) {
        // Then submit for approval
        const submitResult = await submitForApproval((createResult.data as { id: string }).id)
        
        if (submitResult.success) {
          toast.success("Material request submitted for approval successfully")
          router.push("../material-requests")
        } else {
          toast.error(submitResult.message)
        }
      } else {
        toast.error(createResult.message)
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



  const addItem = (data: MaterialRequestItem) => {
    console.log("Adding item:", data) // Debug log
    
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
    
    // Ensure it's always marked as a new item
    const newItemData = { ...data, isNew: true }
    
    append(newItemData)
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
    toast.success("New item added successfully")
  }

  const handleMultiSelectItems = (items: MaterialRequestItem[]) => {
    items.forEach(item => append(item))
  }

  return (
    <div className="w-full max-w-none px-2 sm:px-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {/* Header with Cancel and Create buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Badge 
                variant="secondary" 
                className={REQUEST_STATUS_COLORS[watchedStatus as MRSRequestStatus]}
              >
                {REQUEST_STATUS_LABELS[watchedStatus as MRSRequestStatus]}
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white w-full sm:w-auto">
                {isLoading ? "Saving..." : "Draft"}
              </Button>
              <Button 
                type="button" 
                onClick={handleSubmitForApproval}
                disabled={isLoading}
                className="gap-2 w-full sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {isLoading ? "Submitting..." : "Submit for Approval"}
              </Button>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-border">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">Basic Information</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">


                <FormField
                  control={form.control}
                  name="series"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Series <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select series" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PO">PO</SelectItem>
                          <SelectItem value="JO">JO</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="docNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No.</FormLabel>
                      <FormControl>
                        <Input {...field} disabled className="bg-muted" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Type <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select request type" />
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
                    <FormItem className="hidden">
                      <FormLabel>Business Unit <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                        <FormControl>
                          <SelectTrigger className="w-full bg-muted">
                            <SelectValue placeholder="Select business unit" />
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
                  name="datePrepared"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date Prepared <span className="text-red-500">*</span></FormLabel>
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
                      <FormLabel>Date Required <span className="text-red-500">*</span></FormLabel>
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
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Charge To <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingDepartments}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={
                              isLoadingDepartments 
                                ? "Loading departments..." 
                                : filteredDepartments.length === 0 
                                  ? "No departments available" 
                                  : "Select department to charge to"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredDepartments.map((dept) => (
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
                  name="recApproverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recommending Approver <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!watchedDepartmentId}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={
                              !watchedDepartmentId 
                                ? "Select department first" 
                                : recommendingApprovers.length === 0 
                                  ? "No recommending approvers available" 
                                  : "Select recommending approver"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {recommendingApprovers.length > 0 ? (
                            recommendingApprovers.map((approver) => (
                              <SelectItem key={approver.id} value={approver.id}>
                                {approver.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-approvers" disabled>
                              No recommending approvers configured
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="finalApproverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final Approver <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!watchedDepartmentId}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={
                              !watchedDepartmentId 
                                ? "Select department first" 
                                : finalApprovers.length === 0 
                                  ? "No final approvers available" 
                                  : "Select final approver"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {finalApprovers.length > 0 ? (
                            finalApprovers.map((approver) => (
                              <SelectItem key={approver.id} value={approver.id}>
                                {approver.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-approvers" disabled>
                              No final approvers configured
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="chargeTo"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormLabel>Charge To <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Enter charge to" {...field} required />
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
                
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter purpose"
                          className="resize-none"
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
                      <FormLabel>Deliver To (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter delivery address"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter remarks"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Store Use Switch - Only visible for RDH/MRS users */}
              {session?.user?.isRDHMRS && (
                <FormField
                  control={form.control}
                  name="isStoreUse"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Store Use</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Mark this request as for store use
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
              )}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-base sm:text-lg font-semibold text-foreground">Items</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsMultiSelectDialogOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Existing Items
                  </Button>
                  <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Add New Item
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Item</DialogTitle>
                    </DialogHeader>
                    <Form {...addItemForm}>
                      <div className="space-y-4">
                        <FormField
                          control={addItemForm.control}
                          name="itemCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item Code</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Auto-generated" 
                                  {...field}
                                  disabled
                                  className="bg-muted"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

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
                          <Button 
                            type="button" 
                            onClick={addItemForm.handleSubmit(addItem)}
                            className="w-full sm:w-auto"
                          >
                            Add Item
                          </Button>
                        </DialogFooter>
                      </div>
                    </Form>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </div>
            <div>
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
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-border">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">Totals</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            </div>
          </div>
        </form>
      </Form>

      {/* Multi-Select Items Dialog */}
      <MultiSelectItemsDialog
        open={isMultiSelectDialogOpen}
        onOpenChange={setIsMultiSelectDialogOpen}
        onItemsSelected={handleMultiSelectItems}
      />
    </div>
  )
}