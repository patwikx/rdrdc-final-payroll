"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { importInventoryFromCSV } from "@/lib/actions/inventory-actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, Eye, RefreshCw, Trash2, Package, AlertCircle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface BulkInventoryCreationProps {
  businessUnitId: string
}

interface ImportResult {
  success: boolean
  message?: string
  error?: string
  successCount?: number
  failCount?: number
  errors?: Array<{ row: number; error: string }>
}

interface ParsedRow {
  damageType: string
  damageSeverity: string
  location: string
  tenantName: string
  tenantContact: string
  itemCode: string
  description: string
  quantity: string
  uom: string
  unitAcquisitionCost: string
  damageCondition: string
  isNonServiceable: string
  estimatedRecoveryValue: string
  remarks: string
}

export function BulkInventoryCreation({ businessUnitId }: BulkInventoryCreationProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [parsedData, setParsedData] = useState<ParsedRow[]>([])
  const [csvText, setCsvText] = useState<string>("")
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const [importProgress, setImportProgress] = useState(0)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [currentImportIndex, setCurrentImportIndex] = useState(0)
  const [importedItems, setImportedItems] = useState<string[]>([])
  const [failedItems, setFailedItems] = useState<string[]>([])
  const [uploadedFileName, setUploadedFileName] = useState<string>("")

  const downloadTemplate = () => {
    const headers = [
      'damageType',
      'damageSeverity',
      'location',
      'tenantName',
      'tenantContact',
      'itemCode',
      'description',
      'quantity',
      'uom',
      'unitAcquisitionCost',
      'damageCondition',
      'isNonServiceable',
      'estimatedRecoveryValue',
      'remarks'
    ]

    const sampleData = [
      'WATER_DAMAGE',
      'MODERATE',
      'Warehouse A',
      'John Doe',
      '09123456789',
      'ITM-001',
      'Office Chair',
      '5',
      'pcs',
      '2500.00',
      'Water stains on fabric',
      'FALSE',
      '1000.00',
      'Damaged during flood'
    ]

    const csv = [
      headers.join(','),
      sampleData.join(','),
      // Add empty row for user to fill
      Array(headers.length).fill('').join(',')
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'damaged-inventory-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    setIsLoading(true)
    setImportResult(null)
    setParsedData([])
    setCurrentStep('upload')

    try {
      const text = await file.text()
      setCsvText(text)
      setUploadedFileName(file.name)

      // Parse CSV for preview
      const lines = text.trim().split('\n')
      if (lines.length < 2) {
        toast.error('CSV file is empty or invalid')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim())
      const rows = lines.slice(1).filter(line => line.trim())

      const parsed: ParsedRow[] = rows.map(row => {
        const values = row.split(',').map(v => v.trim())
        const rowData: any = {}
        headers.forEach((header, index) => {
          rowData[header] = values[index] || ''
        })
        return rowData
      })

      setParsedData(parsed)
      setCurrentStep('preview')
      toast.success(`Loaded ${parsed.length} rows. Review and confirm to import.`)
    } catch (error) {
      toast.error('Failed to process CSV file')
    } finally {
      setIsLoading(false)
      event.target.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!csvText || parsedData.length === 0) return

    setIsLoading(true)
    setCurrentStep('importing')
    setImportProgress(0)
    setShowImportDialog(true)
    setCurrentImportIndex(0)
    setImportedItems([])
    setFailedItems([])
    setImportResult(null)

    try {
      // Simulate one-by-one import with progress
      const totalItems = parsedData.length
      
      for (let i = 0; i < totalItems; i++) {
        setCurrentImportIndex(i + 1)
        const progress = ((i + 1) / totalItems) * 100
        setImportProgress(progress)
        
        // Small delay for animation
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Actual import
      const result = await importInventoryFromCSV(businessUnitId, csvText)
      setImportResult(result)

      // Update imported/failed lists based on result
      if (result.success && result.successCount) {
        setImportedItems(parsedData.slice(0, result.successCount).map(r => r.description))
      }
      if (result.failCount && result.failCount > 0) {
        setFailedItems(parsedData.slice(result.successCount || 0).map(r => r.description))
      }

      setImportProgress(100)

      // Keep dialog open for a moment to show completion
      setTimeout(() => {
        setShowImportDialog(false)
        setCurrentStep('complete')
        
        if (result.success) {
          toast.success(result.message || 'Import completed successfully')
        } else {
          toast.error(result.error || 'Import failed')
        }
      }, 1500)

    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import data')
      setImportResult({
        success: false,
        error: 'Failed to import data'
      })
      setShowImportDialog(false)
      setCurrentStep('preview')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setParsedData([])
    setCsvText("")
    setCurrentStep('upload')
    setImportResult(null)
    setImportProgress(0)
    setUploadedFileName("")
  }

  const handleRemoveFile = () => {
    setParsedData([])
    setCsvText("")
    setCurrentStep('upload')
    setUploadedFileName("")
  }

  const handleBackToInventory = () => {
    router.push(`/${businessUnitId}/inventory`)
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
          <h1 className="text-2xl font-semibold tracking-tight">Bulk Import Damaged Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Import multiple damaged inventory items from CSV files
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
        {['Download Template', 'Upload File', 'Import Items', 'Complete'].map((step, index) => (
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
            <span>Importing items...</span>
            <span>{Math.round(importProgress)}%</span>
          </div>
          <Progress value={importProgress} className="w-full" />
          <p className="text-xs text-muted-foreground">
            Processing {parsedData.length} items. Please wait...
          </p>
        </div>
      )}

      {/* Step 1: Download Template & Upload */}
      {currentStep === 'upload' && (
        <>
          {/* Instructions */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>How to import</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside space-y-1 mt-2">
                <li>Download the CSV template</li>
                <li>Fill in your inventory data</li>
                <li>Upload the completed CSV file</li>
                <li>Review and confirm the import</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Download Template Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Template
                </h3>
                <p className="text-sm text-muted-foreground">
                  Get the CSV template with sample data
                </p>
              </div>
              
              <Button onClick={downloadTemplate} className="w-full" disabled={isLoading}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV Template
              </Button>
            </div>

            {/* Upload File Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Your File
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select your completed CSV file
                </p>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  disabled={isLoading}
                />
                <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-4">
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Click to select your CSV file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      CSV files only
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step 2: Preview Data */}
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
                {parsedData.length} items ready for import
              </Badge>
              <Button variant="outline" size="sm" onClick={handleRemoveFile}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove File
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {uploadedFileName && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span className="font-medium">{uploadedFileName}</span>
                <Badge variant="outline">{parsedData.length} rows</Badge>
              </div>
            )}

            <ScrollArea className="h-96 w-full border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Damage Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Item Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="text-xs">{row.damageType}</TableCell>
                      <TableCell className="text-xs">{row.damageSeverity}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{row.description}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{row.uom}</TableCell>
                      <TableCell>₱{parseFloat(row.unitAcquisitionCost || '0').toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{row.location || '-'}</TableCell>
                      <TableCell className="text-xs">{row.tenantName || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.itemCode || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4">
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
              <Button onClick={handleConfirmImport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {parsedData.length} Items
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
                <div className="text-2xl font-bold">{parsedData.length}</div>
                <div className="text-xs text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResult.successCount || 0}</div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResult.failCount || 0}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>

            {/* Success Message */}
            {importResult.success && importResult.successCount && importResult.successCount > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Import Completed Successfully</AlertTitle>
                <AlertDescription>
                  {importResult.successCount} item(s) have been imported and are now available in your damaged inventory system.
                </AlertDescription>
              </Alert>
            )}

            {/* Error Details */}
            {importResult.errors && importResult.errors.length > 0 && (
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
                          {error.error}
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
                onClick={handleBackToInventory}
                className="flex-1"
              >
                View All Items
              </Button>
              <Button 
                onClick={handleReset}
                className="flex-1"
              >
                Import More Items
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Format Reference - Only show on upload step */}
      {currentStep === 'upload' && (
        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-4">CSV Format Reference</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Required fields:</strong> damageType, damageSeverity, description, quantity, uom, unitAcquisitionCost</p>
            <p><strong>Damage Types:</strong> WATER_DAMAGE, FIRE_DAMAGE, PHYSICAL_DAMAGE, NATURAL_DISASTER, ACCIDENT, WEAR_AND_TEAR, OTHER</p>
            <p><strong>Severities:</strong> MINOR, MODERATE, SEVERE, TOTAL_LOSS</p>
            <p><strong>isNonServiceable:</strong> TRUE or FALSE</p>
          </div>
        </div>
      )}

      {/* Animated Import Progress Dialog */}
      <Dialog open={showImportDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              Importing Items
            </DialogTitle>
            <DialogDescription>
              Processing {parsedData.length} items one by one...
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
            
            {/* Current Item Being Processed */}
            {currentImportIndex > 0 && currentImportIndex <= parsedData.length && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
                      {parsedData[currentImportIndex - 1]?.description}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                      {parsedData[currentImportIndex - 1]?.damageType} - {parsedData[currentImportIndex - 1]?.damageSeverity}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Success/Failure Counters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="text-lg font-bold text-green-600">{importedItems.length}</div>
                <div className="text-xs text-green-700 dark:text-green-300">Imported</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="text-lg font-bold text-red-600">{failedItems.length}</div>
                <div className="text-xs text-red-700 dark:text-red-300">Failed</div>
              </div>
            </div>
            
            {/* Recently Imported Items */}
            {importedItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-green-700 dark:text-green-300">
                  Recently Imported:
                </h4>
                <ScrollArea className="h-20">
                  <div className="space-y-1">
                    {importedItems.slice(-5).map((description, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="truncate">{description}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* Failed Items */}
            {failedItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-700 dark:text-red-300">
                  Failed to Import:
                </h4>
                <ScrollArea className="h-20">
                  <div className="space-y-1">
                    {failedItems.slice(-5).map((description, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <XCircle className="h-3 w-3 text-red-600" />
                        <span className="truncate">{description}</span>
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
