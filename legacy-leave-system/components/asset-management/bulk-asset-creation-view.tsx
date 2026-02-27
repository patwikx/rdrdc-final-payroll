"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  FileText,
  Package,
  Eye,
  Trash2
} from "lucide-react"
import { toast } from "sonner"
import { FileUpload } from "@/components/file-upload"
import { validateAndImportAssets, downloadImportTemplate, ImportResult, ImportAssetRow } from "@/lib/actions/import-assets-actions"
import { getAssetCategories, getDepartments } from "@/lib/actions/create-asset-actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface BulkAssetCreationViewProps {
  businessUnitId: string
}

interface AssetCategory {
  id: string
  name: string
  code: string
}

export function BulkAssetCreationView({ businessUnitId }: BulkAssetCreationViewProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [uploadedFile, setUploadedFile] = useState<{ fileName: string; name: string; fileUrl: string } | null>(null)
  const [parsedData, setParsedData] = useState<ImportAssetRow[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string | null }[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState<string>('none')
  const [defaultLocation, setDefaultLocation] = useState<string>('')
  const [numberOfRows, setNumberOfRows] = useState(10)
  const [isPreDepreciatedTemplate, setIsPreDepreciatedTemplate] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [currentImportIndex, setCurrentImportIndex] = useState(0)
  const [importedAssets, setImportedAssets] = useState<string[]>([])
  const [failedAssets, setFailedAssets] = useState<string[]>([])

  // Load categories and departments on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, departmentsData] = await Promise.all([
          getAssetCategories(businessUnitId),
          getDepartments(businessUnitId)
        ])
        
        setCategories(categoriesData)
        setDepartments(departmentsData)
        
        console.log('UI - Loaded departments:', departmentsData)
        console.log('UI - Department IDs:', departmentsData.map(d => d.id))
        
        if (categoriesData.length > 0) {
          setSelectedCategoryId(categoriesData[0].id)
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Failed to load categories and departments")
      }
    }
    
    loadData()
  }, [businessUnitId])

  const getDepartmentIdForTemplate = (selectedValue: string) => {
    if (selectedValue === 'none') return undefined
    
    // Find the department by either code or ID
    const department = departments.find(d => d.code === selectedValue || d.id === selectedValue)
    console.log('getDepartmentIdForTemplate:', {
      selectedValue,
      foundDepartment: department,
      returningId: department?.id
    })
    // Always return the ID for the template
    return department?.id || undefined
  }

  const getSelectedDepartmentName = (selectedValue: string) => {
    if (selectedValue === 'none') return null
    
    // Find the department by either code or ID
    const department = departments.find(d => d.code === selectedValue || d.id === selectedValue)
    return department?.name
  }

  const getDepartmentNameFromCode = (departmentCode: string | undefined) => {
    if (!departmentCode) return '-'
    
    // Find the department by code OR by ID (since template might use ID)
    const department = departments.find(d => d.code === departmentCode || d.id === departmentCode)
    return department?.name || departmentCode // Fallback to code/ID if name not found
  }

  const handleDownloadTemplate = async () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category first")
      return
    }
    
    try {
      const template = await downloadImportTemplate(
        businessUnitId, 
        selectedCategoryId, 
        numberOfRows,
        selectedDepartmentCode === 'none' ? undefined : getDepartmentIdForTemplate(selectedDepartmentCode),
        defaultLocation,
        isPreDepreciatedTemplate
      )
      console.log('Generated template:', template)
      
      const selectedCategory = categories.find(c => c.id === selectedCategoryId)
      const fileName = `asset-import-template-${selectedCategory?.code || 'assets'}.csv`
      
      const blob = new Blob([template], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success(`Template downloaded successfully with ${numberOfRows} pre-generated item codes`)
    } catch (error) {
      console.error("Template download error:", error)
      toast.error("Failed to download template")
    }
  }

  const handleFileSelect = (file: File) => {
    console.log('File selected:', file.name, file.type, file.size)
    
    // Read file content directly in browser
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        console.log('File content length:', text.length)
        console.log('File content preview:', text.substring(0, 500))
        
        const parsed = parseCSV(text)
        
        // Auto-detect pre-depreciated assets based on presence of pre-depreciation fields
        const processedData = parsed.map(row => ({
          ...row,
          isPreDepreciated: !!(
            row.originalPurchaseDate || 
            row.originalPurchasePrice || 
            row.originalUsefulLifeMonths || 
            row.priorDepreciationAmount || 
            row.priorDepreciationMonths || 
            row.systemEntryDate || 
            row.systemEntryBookValue
          )
        }))
        
        setParsedData(processedData)
        
        if (parsed.length === 0) {
          toast.error("No valid data found in the file. Please check the file format and required fields.")
          return
        }
        
        // Set uploaded file info and proceed to preview
        setUploadedFile({
          fileName: file.name,
          name: file.name,
          fileUrl: '' // Not needed since we read directly
        })
        setCurrentStep('preview')
        toast.success(`Successfully parsed ${parsed.length} rows from the file`)
        
      } catch (error) {
        console.error("Error parsing file:", error)
        toast.error(`Failed to parse the uploaded file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    reader.onerror = () => {
      toast.error("Failed to read the file")
    }
    
    reader.readAsText(file)
  }

  const handleFileUpload = async (result: { fileName: string; name: string; fileUrl: string }) => {
    console.log('File upload result:', result)
    // This is now just a fallback - we prefer direct file reading
    setUploadedFile(result)
    setCurrentStep('preview')
    
    try {
      // Fetch and parse the uploaded file
      console.log('Fetching file from:', result.fileUrl)
      const response = await fetch(result.fileUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
      }
      
      const text = await response.text()
      console.log('File content length:', text.length)
      console.log('File content preview:', text.substring(0, 500))
      
      const parsed = parseCSV(text)
      
      // Auto-detect pre-depreciated assets based on presence of pre-depreciation fields
      const processedData = parsed.map(row => ({
        ...row,
        isPreDepreciated: !!(
          row.originalPurchaseDate || 
          row.originalPurchasePrice || 
          row.originalUsefulLifeMonths || 
          row.priorDepreciationAmount || 
          row.priorDepreciationMonths || 
          row.systemEntryDate || 
          row.systemEntryBookValue
        )
      }))
      
      setParsedData(processedData)
      
      if (parsed.length === 0) {
        toast.error("No valid data found in the file. Please check the file format and required fields.")
        setCurrentStep('upload')
        return
      }
      
      toast.success(`Successfully parsed ${parsed.length} rows from the file`)
    } catch (error) {
      console.error("Error parsing file:", error)
      toast.error(`Failed to parse the uploaded file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setCurrentStep('upload')
    }
  }

  const handleUploadError = (error: string) => {
    toast.error(error)
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"'
          i += 2
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
          i++
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim())
        current = ''
        i++
      } else {
        current += char
        i++
      }
    }
    
    // Add the last field
    result.push(current.trim())
    return result
  }

  const parseCSV = (text: string): ImportAssetRow[] => {
    console.log('Parsing CSV text:', text.substring(0, 200) + '...')
    
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    console.log('Found lines:', lines.length)
    
    if (lines.length < 2) {
      console.log('Not enough lines in CSV')
      return []
    }

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
    console.log('Headers:', headers)
    
    const data: ImportAssetRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim())
      console.log(`Row ${i} values:`, values)
      
      const row: ImportAssetRow = {
        itemCode: '',
        description: '',
        categoryName: ''
      }

      headers.forEach((header, index) => {
        const value = values[index] || ''
        switch (header) {
          case 'itemCode':
            row.itemCode = value
            break
          case 'description':
            row.description = value
            break
          case 'categoryName':
            row.categoryName = value
            break
          case 'serialNumber':
            row.serialNumber = value || undefined
            break
          case 'modelNumber':
            row.modelNumber = value || undefined
            break
          case 'brand':
            row.brand = value || undefined
            break
          case 'purchaseDate':
            row.purchaseDate = value || undefined
            break
          case 'purchasePrice':
            row.purchasePrice = value && !isNaN(parseFloat(value)) ? parseFloat(value) : undefined
            break
          case 'warrantyExpiry':
            row.warrantyExpiry = value || undefined
            break
          case 'departmentCode':
            row.departmentCode = value || undefined
            break
          case 'location':
            row.location = value || undefined
            break
          case 'notes':
            row.notes = value || undefined
            break
          case 'status':
            row.status = value || undefined
            break
          case 'usefulLifeMonths':
            row.usefulLifeMonths = value && !isNaN(parseInt(value)) ? parseInt(value) : undefined
            break
          case 'salvageValue':
            row.salvageValue = value && !isNaN(parseFloat(value)) ? parseFloat(value) : undefined
            break
          case 'depreciationMethod':
            row.depreciationMethod = value || undefined
            break
          case 'depreciationStartDate':
            row.depreciationStartDate = value || undefined
            break
          case 'assetAccountCode':
            row.assetAccountCode = value || undefined
            break
          case 'depreciationExpenseAccountCode':
            row.depreciationExpenseAccountCode = value || undefined
            break
          case 'accumulatedDepAccountCode':
            row.accumulatedDepAccountCode = value || undefined
            break
          // Pre-depreciation fields
          case 'isPreDepreciated':
            row.isPreDepreciated = value === 'TRUE' || value === 'true' || value === '1'
            break
          case 'originalPurchaseDate':
            row.originalPurchaseDate = value || undefined
            break
          case 'originalPurchasePrice':
            row.originalPurchasePrice = value && !isNaN(parseFloat(value)) ? parseFloat(value) : undefined
            break
          case 'originalUsefulLifeMonths':
            row.originalUsefulLifeMonths = value && !isNaN(parseInt(value)) ? parseInt(value) : undefined
            break
          case 'priorDepreciationAmount':
          case 'accumulatedDepreciationAmount': // New column name maps to priorDepreciationAmount
            row.priorDepreciationAmount = value && !isNaN(parseFloat(value)) ? parseFloat(value) : undefined
            break
          case 'priorDepreciationMonths':
          case 'accumulatedDepreciationMonths': // New column name maps to priorDepreciationMonths
            row.priorDepreciationMonths = value && !isNaN(parseInt(value)) ? parseInt(value) : undefined
            break
          case 'systemEntryDate':
            row.systemEntryDate = value || undefined
            break
          case 'systemEntryBookValue':
            row.systemEntryBookValue = value && !isNaN(parseFloat(value)) ? parseFloat(value) : undefined
            break
          case 'useSystemEntryAsStart':
            row.useSystemEntryAsStart = value === 'TRUE' || value === 'true' || value === '1'
            break
        }
      })

      console.log(`Parsed row ${i}:`, row)

      if (row.itemCode && row.description && row.categoryName) {
        data.push(row)
      } else {
        console.log(`Skipping row ${i} - missing required fields:`, {
          itemCode: row.itemCode,
          description: row.description,
          categoryName: row.categoryName
        })
      }
    }

    console.log('Final parsed data:', data)
    return data
  }

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error("No data to import")
      return
    }

    setIsLoading(true)
    setCurrentStep('importing')
    setImportProgress(0)
    setShowImportDialog(true)
    setCurrentImportIndex(0)
    setImportedAssets([])
    setFailedAssets([])
    
    try {
      const result = await importAssetsOneByOne(parsedData, businessUnitId)
      
      setImportProgress(100)
      setImportResult(result)
      
      // Keep dialog open for a moment to show completion
      setTimeout(() => {
        setShowImportDialog(false)
        setCurrentStep('complete')
        
        if (result.success) {
          toast.success(result.message)
          router.refresh()
        } else {
          toast.error(result.message)
        }
      }, 2000)

    } catch (error) {
      console.error("Import error:", error)
      toast.error("Failed to process import")
      setShowImportDialog(false)
      setCurrentStep('preview')
    } finally {
      setIsLoading(false)
    }
  }

  const importAssetsOneByOne = async (data: ImportAssetRow[], businessUnitId: string) => {
    const totalAssets = data.length
    let successCount = 0
    let errorCount = 0
    const errors: any[] = []
    
    for (let i = 0; i < data.length; i++) {
      const asset = data[i]
      setCurrentImportIndex(i + 1)
      
      try {
        // Import single asset
        const singleAssetResult = await validateAndImportAssets([asset], businessUnitId)
        
        if (singleAssetResult.success && singleAssetResult.successCount > 0) {
          setImportedAssets(prev => [...prev, asset.itemCode])
          successCount++
        } else {
          setFailedAssets(prev => [...prev, asset.itemCode])
          errorCount++
          if (singleAssetResult.errors.length > 0) {
            errors.push(...singleAssetResult.errors)
          }
        }
      } catch (error) {
        setFailedAssets(prev => [...prev, asset.itemCode])
        errorCount++
        errors.push({
          row: i + 2,
          itemCode: asset.itemCode,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      
      // Update progress
      const progress = ((i + 1) / totalAssets) * 100
      setImportProgress(progress)
      
      // Small delay for animation effect
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    return {
      success: successCount > 0,
      message: successCount > 0 
        ? `Successfully imported ${successCount} asset(s)${errorCount > 0 ? ` with ${errorCount} error(s)` : ''}`
        : "No assets were imported",
      totalRows: totalAssets,
      successCount,
      errorCount,
      errors
    }
  }

  const handleReset = () => {
    setUploadedFile(null)
    setParsedData([])
    setImportResult(null)
    setImportProgress(0)
    setCurrentStep('upload')
  }

  const handleBackToAssets = () => {
    router.push(`/${businessUnitId}/asset-management/assets`)
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setParsedData([])
    setCurrentStep('upload')
  }

  const getStepNumber = (step: string) => {
    switch (step) {
      case 'upload': return 1
      case 'preview': return 2
      case 'importing': return 3
      case 'complete': return 4
      default: return 1
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Bulk Asset Creation</h1>
          <p className="text-sm text-muted-foreground">
            Import multiple assets from Excel/CSV files with complete configuration
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            Step {getStepNumber(currentStep)} of 4
          </Badge>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {['Download Template', 'Upload File', 'Import Assets', 'Complete'].map((step, index) => (
          <div key={step} className="flex items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              index + 1 <= getStepNumber(currentStep) 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {index + 1}
            </div>
            <span className="ml-2 text-sm font-medium hidden sm:block">{step}</span>
            {index < 3 && (
              <div className={`ml-4 h-0.5 w-16 ${
                index + 1 < getStepNumber(currentStep) ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Import Progress */}
      {currentStep === 'importing' && (
        <div className="space-y-2 p-6 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <span>Importing assets...</span>
            <span>{importProgress}%</span>
          </div>
          <Progress value={importProgress} className="w-full" />
          <p className="text-xs text-muted-foreground">
            Processing {parsedData.length} assets. Please wait...
          </p>
        </div>
      )}

      {/* Step 1: Download Template */}
      {currentStep === 'upload' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Template
              </h3>
              <p className="text-sm text-muted-foreground">
                Select a category to generate a template with pre-generated item codes
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Template Type Selection */}
              <div className="p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Template Type</Label>
                    <p className="text-xs text-muted-foreground">
                      {isPreDepreciatedTemplate 
                        ? "Generate template for assets with existing depreciation from old system"
                        : "Generate template for newly acquired assets"
                      }
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="template-type" className="text-sm">
                      {isPreDepreciatedTemplate ? "Pre-Depreciated Assets" : "New Assets"}
                    </Label>
                    <Switch
                      id="template-type"
                      checked={isPreDepreciatedTemplate}
                      onCheckedChange={setIsPreDepreciatedTemplate}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category-select">Category *</Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name} ({category.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rows-input">Number of Rows</Label>
                  <Select value={numberOfRows.toString()} onValueChange={(value) => setNumberOfRows(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 rows</SelectItem>
                      <SelectItem value="10">10 rows</SelectItem>
                      <SelectItem value="25">25 rows</SelectItem>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department-select">Default Department (Optional)</Label>
                  <Select value={selectedDepartmentCode} onValueChange={setSelectedDepartmentCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default department</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.code || department.id}>
                          {department.name} {department.code && `(${department.code})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="location-input">Default Location (Optional)</Label>
                  <Input
                    id="location-input"
                    placeholder="e.g., IT Office - Floor 2"
                    value={defaultLocation}
                    onChange={(e) => setDefaultLocation(e.target.value)}
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleDownloadTemplate} 
                className="w-full"
                disabled={isLoading || !selectedCategoryId}
              >
                <Download className="h-4 w-4 mr-2" />
                Download {isPreDepreciatedTemplate ? "Pre-Depreciated" : "New Assets"} Template ({numberOfRows} rows)
              </Button>
              
              {selectedCategoryId && (
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                  <p><strong>Selected Category:</strong> {categories.find(c => c.id === selectedCategoryId)?.name}</p>
                  <p><strong>Item Code Format:</strong> {categories.find(c => c.id === selectedCategoryId)?.code}-XXXXX</p>
                  <p><strong>Template Type:</strong> {isPreDepreciatedTemplate ? "Pre-Depreciated Assets" : "New Assets"}</p>
                  <p><strong>Template will include:</strong> {numberOfRows} pre-generated item codes</p>
                  {isPreDepreciatedTemplate && (
                    <p><strong>Fields included:</strong> Original purchase info, prior depreciation, system entry data</p>
                  )}
                  {!isPreDepreciatedTemplate && (
                    <p><strong>Fields included:</strong> Purchase info, depreciation settings, GL accounts</p>
                  )}
                  {selectedDepartmentCode && selectedDepartmentCode !== 'none' && (
                    <p><strong>Default Department:</strong> {getSelectedDepartmentName(selectedDepartmentCode)}</p>
                  )}
                  {defaultLocation && (
                    <p><strong>Default Location:</strong> {defaultLocation}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Import Instructions
              </h3>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Required Information</AlertTitle>
              <AlertDescription className="text-sm space-y-2 mt-2">
                <div className="space-y-1">
                  <p><strong>Required fields:</strong> itemCode, description, categoryName</p>
                  {isPreDepreciatedTemplate ? (
                    <>
                      <p><strong>Pre-Depreciated Required:</strong> originalPurchaseDate, originalPurchasePrice, originalUsefulLifeMonths, systemEntryDate, systemEntryBookValue</p>
                      <p><strong>Prior Depreciation:</strong> Fill accumulatedDepreciationAmount and accumulatedDepreciationMonths from old system</p>
                      <p><strong>Boolean fields:</strong> Use TRUE/FALSE for useSystemEntryAsStart (recommended: TRUE)</p>
                    </>
                  ) : (
                    <>
                      <p><strong>New Asset Fields:</strong> purchaseDate, purchasePrice, usefulLifeMonths, depreciationStartDate</p>
                      <p><strong>Useful Life:</strong> Enter total months (e.g., 36 for 3 years)</p>
                    </>
                  )}
                  <p><strong>Date format:</strong> YYYY-MM-DD (e.g., 2024-01-15)</p>
                  <p><strong>Item Codes:</strong> Pre-generated based on selected category</p>
                  <p><strong>Optional fields:</strong> departmentCode, GL account codes, serialNumber, etc.</p>
                  <p><strong>Empty fields:</strong> Leave optional fields empty if not needed</p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Step 2: File Upload */}
      {currentStep === 'upload' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload Your File
            </h3>
            <p className="text-sm text-muted-foreground">
              Select your completed CSV or Excel file for import
            </p>
          </div>
          <div className="space-y-4">
            {/* Custom file input for direct reading */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                      handleFileSelect(file)
                    } else {
                      toast.error("Please select a CSV file. Excel files (.xlsx, .xls) are not yet supported.")
                    }
                  }
                }}
                className="hidden"
                id="csv-file-input"
                disabled={isLoading}
              />
              <label 
                htmlFor="csv-file-input" 
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Click to select your CSV/Excel file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maximum file size: 10MB • CSV files only (Excel support coming soon)
                  </p>
                </div>
              </label>
            </div>
            
            {/* Fallback: Original FileUpload component */}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Alternative: Upload to server first</summary>
              <div className="mt-2">
                <FileUpload
                  onUploadComplete={handleFileUpload}
                  onUploadError={handleUploadError}
                  accept=".csv,.xlsx,.xls"
                  maxSize={10}
                  disabled={isLoading}
                />
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Step 3: Preview Data */}
      {currentStep === 'preview' && parsedData.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview Import Data
              </h3>
              <p className="text-sm text-muted-foreground">
                Review the parsed data before importing. Make sure all information is correct.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {parsedData.length} assets ready for import
              </Badge>
              <Button variant="outline" size="sm" onClick={handleRemoveFile}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove File
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {uploadedFile && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span className="font-medium">{uploadedFile.name}</span>
                <Badge variant="outline">{parsedData.length} rows</Badge>
              </div>
            )}

            <ScrollArea className="h-96 w-full border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    {/* Show different columns based on asset type */}
                    {parsedData.some(row => row.isPreDepreciated) ? (
                      <>
                        <TableHead>Original Price</TableHead>
                        <TableHead>Original Useful Life</TableHead>
                        <TableHead>Accumulated Months</TableHead>
                        <TableHead>Depreciated Amount</TableHead>
                        <TableHead>Book Value</TableHead>
                        <TableHead>System Entry Date</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Brand</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Purchase Price</TableHead>
                        <TableHead>Useful Life (Months)</TableHead>
                        <TableHead>Purchase Date</TableHead>
                      </>
                    )}
                    <TableHead>Asset Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">{row.itemCode}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.description}</TableCell>
                      <TableCell className="text-xs">{row.categoryName}</TableCell>
                      <TableCell className="text-xs">{getDepartmentNameFromCode(row.departmentCode)}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">{row.location || '-'}</TableCell>
                      
                      {/* Show different data based on asset type */}
                      {parsedData.some(r => r.isPreDepreciated) ? (
                        <>
                          <TableCell className="text-xs">
                            {row.originalPurchasePrice ? `₱${row.originalPurchasePrice.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.originalUsefulLifeMonths ? `${row.originalUsefulLifeMonths} months` : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.priorDepreciationMonths ? `${row.priorDepreciationMonths} months` : '-'}
                          </TableCell>

                          <TableCell className="text-xs">
                            {row.priorDepreciationAmount ? `₱${row.priorDepreciationAmount.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.systemEntryBookValue ? `₱${row.systemEntryBookValue.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.systemEntryDate || '-'}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-xs">{row.brand || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{row.serialNumber || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {row.purchasePrice ? `₱${row.purchasePrice.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.usefulLifeMonths || '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.purchaseDate || '-'}
                          </TableCell>
                        </>
                      )}
                      
                      <TableCell>
                        {row.isPreDepreciated ? (
                          <Badge variant="secondary" className="text-xs">
                            Pre-Depreciated
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            New Asset
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.status || 'AVAILABLE'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4">
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {parsedData.length} Assets
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Import Results */}
      {currentStep === 'complete' && importResult && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Import Results
            </h3>
          </div>

          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{importResult.totalRows}</div>
                <div className="text-xs text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResult.successCount}</div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResult.errorCount}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>

            {/* Success Message */}
            {importResult.success && importResult.successCount > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Import Completed Successfully</AlertTitle>
                <AlertDescription>
                  {importResult.successCount} asset(s) have been imported and are now available in your asset management system.
                </AlertDescription>
              </Alert>
            )}

            {/* Error Details */}
            {importResult.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Import Errors ({importResult.errors.length})
                </h4>
                <ScrollArea className="h-48 w-full border rounded-md p-3">
                  <div className="space-y-2">
                    {importResult.errors.map((error: any, index: number) => (
                      <Alert key={index} variant="destructive" className="py-2">
                        <AlertCircle className="h-3 w-3" />
                        <AlertTitle className="text-xs">Row {error.row}</AlertTitle>
                        <AlertDescription className="text-xs">
                          <span className="font-medium">{error.itemCode}:</span> {error.error}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={handleBackToAssets}
                className="flex-1"
              >
                View All Assets
              </Button>
              <Button 
                onClick={handleReset}
                className="flex-1"
              >
                Import More Assets
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Animated Import Progress Dialog */}
      <Dialog open={showImportDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              Importing Assets
            </DialogTitle>
            <DialogDescription>
              Processing {parsedData.length} assets one by one...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{currentImportIndex} of {parsedData.length}</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
            
            {/* Current Asset Being Processed */}
            {currentImportIndex > 0 && currentImportIndex <= parsedData.length && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
                      {parsedData[currentImportIndex - 1]?.itemCode}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                      {parsedData[currentImportIndex - 1]?.description}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Success/Failure Counters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="text-lg font-bold text-green-600">{importedAssets.length}</div>
                <div className="text-xs text-green-700 dark:text-green-300">Imported</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="text-lg font-bold text-red-600">{failedAssets.length}</div>
                <div className="text-xs text-red-700 dark:text-red-300">Failed</div>
              </div>
            </div>
            
            {/* Recently Imported Assets */}
            {importedAssets.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-green-700 dark:text-green-300">
                  Recently Imported:
                </h4>
                <ScrollArea className="h-20">
                  <div className="space-y-1">
                    {importedAssets.slice(-5).map((itemCode, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="font-mono">{itemCode}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* Failed Assets */}
            {failedAssets.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-700 dark:text-red-300">
                  Failed to Import:
                </h4>
                <ScrollArea className="h-20">
                  <div className="space-y-1">
                    {failedAssets.slice(-5).map((itemCode, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <XCircle className="h-3 w-3 text-red-600" />
                        <span className="font-mono">{itemCode}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}