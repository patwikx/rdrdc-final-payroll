"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getDamagedInventoryReport } from "@/lib/actions/inventory-actions"
import { Printer, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface DamagedInventoryReportProps {
  businessUnitId: string
}

interface ReportData {
  items: Array<{
    id: string
    itemCode: string | null
    description: string
    quantity: number
    uom: string
    unitAcquisitionCost: number
    totalAcquisitionCost: number
    damageType: string | null
    damageCondition: string | null
    location: string | null
    unitSellingPrice: number | null
    totalSellingAmount: number
    soldQuantity: number | null
    saleDate: Date | null
    profitLoss: number
    status: string
    createdAt: Date
  }>
  summary: {
    totalItems: number
    totalItemsAdded: number
    totalItemsSold: number
    totalAcquisitionCost: number
    totalSellingAmount: number
    totalProfitLoss: number
  }
}

export function DamagedInventoryReport({ businessUnitId }: DamagedInventoryReportProps) {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates")
      return
    }

    setIsLoading(true)
    try {
      const data = await getDamagedInventoryReport(businessUnitId, startDate, endDate)
      setReportData(data)
    } catch (error) {
      console.error("Error generating report:", error)
      alert("Failed to generate report")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: letter landscape;
            margin: 0.5in;
          }
          
          body * {
            visibility: hidden;
          }
          
          #print-report, #print-report * {
            visibility: visible;
          }
          
          #print-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }
          
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Damaged Inventory Report</h1>
          <p className="text-muted-foreground mt-1">
            Generate reports for damaged inventory items by date range
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="border rounded-lg p-6 no-print">
          <h2 className="text-lg font-semibold mb-4">Report Parameters</h2>
          <p className="text-sm text-muted-foreground mb-4">Select date range to generate report</p>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button onClick={handleGenerateReport} disabled={isLoading} className="w-full">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {isLoading ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </div>

        {/* Report Actions */}
        {reportData && (
          <div className="flex gap-2 no-print">
            <Button onClick={handlePrint} variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Print Report
            </Button>
          </div>
        )}

        {/* Report Content */}
        {reportData && startDate && endDate && (
          <div id="print-report">
            <div className="p-8 border rounded-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
              {/* Report Header */}
              <div className="text-center mb-6 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-bold mb-2">DAMAGED INVENTORY REPORT</h1>
                <p className="text-sm">
                  Period: {format(startDate, "MMMM dd, yyyy")} to {format(endDate, "MMMM dd, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Generated on {format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}
                </p>
              </div>

              {/* Summary Statistics */}
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-3 border-b pb-2">SUMMARY</h2>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="border rounded p-3">
                    <p className="text-muted-foreground text-xs">Total Items</p>
                    <p className="text-2xl font-bold">{reportData.summary.totalItems}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-muted-foreground text-xs">Items Added</p>
                    <p className="text-2xl font-bold">{reportData.summary.totalItemsAdded}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-muted-foreground text-xs">Items Sold</p>
                    <p className="text-2xl font-bold">{reportData.summary.totalItemsSold}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-muted-foreground text-xs">Total Acquisition Cost</p>
                    <p className="text-xl font-bold">₱{reportData.summary.totalAcquisitionCost.toLocaleString()}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-muted-foreground text-xs">Total Selling Amount</p>
                    <p className="text-xl font-bold">₱{reportData.summary.totalSellingAmount.toLocaleString()}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-muted-foreground text-xs">Total Profit/Loss</p>
                    <p className={`text-xl font-bold ${reportData.summary.totalProfitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ₱{reportData.summary.totalProfitLoss.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-3 border-b pb-2">ITEM DETAILS</h2>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2">
                      <th className="text-left p-2 border">Item Code</th>
                      <th className="text-left p-2 border">Description</th>
                      <th className="text-center p-2 border">Qty</th>
                      <th className="text-left p-2 border">Damage Type</th>
                      <th className="text-right p-2 border">Acq. Cost</th>
                      <th className="text-right p-2 border">Sell Amt</th>
                      <th className="text-right p-2 border">P/L</th>
                      <th className="text-center p-2 border">Status</th>
                      <th className="text-center p-2 border">Date Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center p-4 text-muted-foreground">
                          No items found for the selected date range
                        </td>
                      </tr>
                    ) : (
                      reportData.items.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2 border font-mono">{item.itemCode || '-'}</td>
                          <td className="p-2 border">{item.description}</td>
                          <td className="p-2 border text-center">{item.quantity} {item.uom}</td>
                          <td className="p-2 border">{item.damageType?.replace(/_/g, ' ') || '-'}</td>
                          <td className="p-2 border text-right">₱{item.totalAcquisitionCost.toLocaleString()}</td>
                          <td className="p-2 border text-right">
                            {item.unitSellingPrice ? `₱${item.totalSellingAmount.toLocaleString()}` : '-'}
                          </td>
                          <td className={`p-2 border text-right font-semibold ${item.profitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {item.unitSellingPrice ? `₱${item.profitLoss.toLocaleString()}` : '-'}
                          </td>
                          <td className="p-2 border text-center">{item.status}</td>
                          <td className="p-2 border text-center">{format(new Date(item.createdAt), "MMM dd, yyyy")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t-2 border-black text-xs text-center">
                <p>This is a system-generated report. For accounting purposes only.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
