"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft,
  Download, 
  Printer
} from "lucide-react";
import { format } from "date-fns";
import { DepreciationAnalysisData } from "@/lib/actions/depreciation-reports-actions";
import { toast } from "sonner";

interface DepreciationSchedulePreviewProps {
  analysisData: DepreciationAnalysisData[];
  businessUnit: {
    id: string;
    name: string;
  };
  filters: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    departmentId?: string;
    depreciationMethod?: string;
    status?: string;
    isFullyDepreciated?: boolean;
  };
}

interface DepreciationEntry {
  date: string;
  code: string;
  assetDescription: string;
  glAccount: string;
  bldgCode: string;
  profitCenter: string;
  amount: number;
}

export function DepreciationSchedulePreview({
  analysisData,
  businessUnit,
  filters
}: DepreciationSchedulePreviewProps) {
  const router = useRouter();

  // Filter assets that have complete depreciation data
  const assetsWithDepreciation = analysisData.filter(asset => 
    asset.depreciationMethod && 
    asset.usefulLifeYears && 
    asset.purchasePrice && 
    asset.depreciationStartDate &&
    asset.monthlyDepreciation &&
    Number(asset.monthlyDepreciation) > 0
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Generate depreciation entries for the current month
  const generateDepreciationEntries = (): DepreciationEntry[] => {
    const currentDate = new Date();
    const currentMonth = format(currentDate, 'MM/dd/yyyy');
    
    const entries: DepreciationEntry[] = [];
    
    assetsWithDepreciation.forEach(asset => {
      entries.push({
        date: currentMonth,
        code: asset.itemCode,
        assetDescription: asset.description,
        glAccount: `Depreciation Expense-${asset.category.name}`,
        bldgCode: asset.department?.name || 'General',
        profitCenter: asset.department?.name || 'General',
        amount: Number(asset.monthlyDepreciation)
      });
    });

    return entries.sort((a, b) => a.profitCenter.localeCompare(b.profitCenter));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Unable to open print window. Please check your popup blocker.");
      return;
    }

    const printContent = generatePrintHTML();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
    
    toast.success("Print dialog opened");
  };

  const handleDownload = () => {
    handlePrint(); // For now, use print functionality
  };

  const handleBack = () => {
    router.back();
  };

  const depreciationEntries = generateDepreciationEntries();
  const totalDepreciation = depreciationEntries.reduce((sum, entry) => sum + entry.amount, 0);

  // Group entries by profit center for subtotals
  const groupedEntries = new Map<string, DepreciationEntry[]>();
  depreciationEntries.forEach(entry => {
    const key = entry.profitCenter;
    if (!groupedEntries.has(key)) {
      groupedEntries.set(key, []);
    }
    groupedEntries.get(key)!.push(entry);
  });

  const generatePrintHTML = () => {
    const currentMonth = format(new Date(), 'MMMM yyyy');
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Depreciation Schedule - ${businessUnit.name}</title>
          <style>
            @page {
              size: legal landscape;
              margin: 0.5in;
            }
            
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: white;
              font-size: 11px;
              line-height: 1.2;
            }
            
            .page-header {
              text-align: center;
              margin-bottom: 25px;
              border-bottom: 3px solid #000;
              padding-bottom: 12px;
            }
            
            .business-unit-name {
              font-size: 24px;
              font-weight: bold;
              color: #000;
              margin: 0 0 6px 0;
              letter-spacing: 1px;
            }
            
            .report-title {
              font-size: 16px;
              font-weight: bold;
              margin: 4px 0;
              color: #000;
            }
            
            .report-subtitle {
              font-size: 12px;
              margin: 2px 0;
              color: #666;
            }
            
            .report-period {
              font-size: 12px;
              margin: 4px 0 0 0;
              color: #666;
            }
            
            .schedule-content {
              margin-top: 20px;
            }
            
            .column-headers {
              display: grid;
              grid-template-columns: 60px 80px 1fr 180px 80px 100px 100px;
              gap: 8px;
              padding: 8px 0;
              font-weight: bold;
              font-size: 11px;
              margin-bottom: 10px;
            }
            
            .group-section {
              margin-bottom: 20px;
            }
            
            .group-header {
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 5px;
            }
            
            .department-header {
              font-weight: bold;
              font-size: 11px;
              margin-bottom: 8px;
            }
            
            .entry-row {
              display: grid;
              grid-template-columns: 60px 80px 1fr 180px 80px 100px 100px;
              gap: 8px;
              padding: 3px 0;
              font-size: 10px;
            }
            
            .col-amount {
              text-align: right;
              font-family: 'Courier New', monospace;
            }
            
            .dotted-line {
              height: 1px;
              border-bottom: 1px dotted #666;
              margin: 8px 0;
            }
            
            .subtotal-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              font-weight: bold;
              font-size: 11px;
            }
            
            .subtotal-amount {
              font-family: 'Courier New', monospace;
            }
            
            .grand-total {
              margin-top: 30px;
            }
            
            .total-line {
              height: 2px;
              background: #000;
              margin: 5px 0;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 0;
              font-weight: bold;
              font-size: 13px;
            }
            
            .total-label {
              text-align: center;
              flex: 1;
            }
            
            .total-amount {
              font-family: 'Courier New', monospace;
              min-width: 100px;
              text-align: right;
            }
            
            @media print {
              body { 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="page-header">
            <h1 class="business-unit-name">${businessUnit.name.toUpperCase()}</h1>
            <div class="report-title">DEPRECIATION SCHEDULE</div>
            <div class="report-subtitle">LAPSING CODE: 000008</div>
            <div class="report-period">FOR THE MONTH ${currentMonth.toUpperCase()}</div>
          </div>
          
          <div class="schedule-content">
            <!-- Column Headers -->
            <div class="column-headers">
              <span>Date</span>
              <span>Code</span>
              <span>Asset Description</span>
              <span>GL Account</span>
              <span>Bldg Code</span>
              <span>Profit Center</span>
              <span>Amount</span>
            </div>

            <!-- Schedule Body -->
            ${Array.from(groupedEntries.entries()).map(([profitCenter, entries]) => {
              const subtotal = entries.reduce((sum, entry) => sum + entry.amount, 0);
              return `
                <div class="group-section">
                  <!-- Group Header -->
                  <div class="group-header">${profitCenter}</div>
                  
                  <!-- Department Subheader -->
                  <div class="department-header">${entries[0]?.bldgCode || 'General'}</div>
                  
                  <!-- Entries -->
                  ${entries.map(entry => `
                    <div class="entry-row">
                      <span>${entry.date}</span>
                      <span>${entry.code}</span>
                      <span>${entry.assetDescription}</span>
                      <span>${entry.glAccount}</span>
                      <span>${entry.bldgCode}</span>
                      <span>${entry.profitCenter}</span>
                      <span class="col-amount">${formatCurrency(entry.amount)}</span>
                    </div>
                  `).join('')}
                  
                  <!-- Dotted line -->
                  <div class="dotted-line"></div>
                  
                  <!-- Subtotal -->
                  <div class="subtotal-row">
                    <span>TOTAL ${profitCenter}</span>
                    <span class="subtotal-amount">${formatCurrency(subtotal)}</span>
                  </div>
                </div>
              `;
            }).join('')}
            
            <!-- Grand Total -->
            <div class="grand-total">
              <div class="total-line"></div>
              <div class="total-row">
                <span class="total-label">TOTAL DEPRECIATION FOR THE MONTH</span>
                <span class="total-amount">${formatCurrency(totalDepreciation)}</span>
              </div>
              <div class="total-line"></div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden bg-background border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Depreciation Schedule Report Preview
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleDownload}
                disabled={depreciationEntries.length === 0}
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                onClick={handlePrint}
                disabled={depreciationEntries.length === 0}
                size="lg"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Print Content - Legal Paper Size Simulation */}
      <div className="print-page-container">
        <div className="print-page">
          {/* Header */}
          <div className="page-header">
            <h1 className="business-unit-name">{businessUnit.name.toUpperCase()}</h1>
            <div className="report-title">DEPRECIATION SCHEDULE</div>
            <div className="report-subtitle">LAPSING CODE: 000008</div>
            <div className="report-period">FOR THE MONTH {format(new Date(), 'MMMM yyyy').toUpperCase()}</div>
          </div>

          {depreciationEntries.length === 0 ? (
            <div className="no-data">
              <h3>No Depreciation Entries</h3>
              <p>No assets found with monthly depreciation for the current period.</p>
            </div>
          ) : (
            <div className="schedule-content">
              {/* Column Headers */}
              <div className="column-headers">
                <div className="header-row">
                  <span className="col-date">Date</span>
                  <span className="col-code">Code</span>
                  <span className="col-description">Asset Description</span>
                  <span className="col-gl">GL Account</span>
                  <span className="col-bldg">Bldg Code</span>
                  <span className="col-profit">Profit Center</span>
                  <span className="col-amount">Amount</span>
                </div>
              </div>

              {/* Schedule Content */}
              <div className="schedule-body">
                {Array.from(groupedEntries.entries()).map(([profitCenter, entries]) => {
                  const subtotal = entries.reduce((sum, entry) => sum + entry.amount, 0);
                  return (
                    <div key={profitCenter} className="group-section">
                      {/* Group Header */}
                      <div className="group-header">
                        <strong>{profitCenter}</strong>
                      </div>
                      
                      {/* Department/Category Subheader */}
                      <div className="department-header">
                        {entries[0]?.bldgCode || 'General'}
                      </div>
                      
                      {/* Entries */}
                      {entries.map((entry, index) => (
                        <div key={`${profitCenter}-${index}`} className="entry-row">
                          <span className="col-date">{entry.date}</span>
                          <span className="col-code">{entry.code}</span>
                          <span className="col-description">{entry.assetDescription}</span>
                          <span className="col-gl">{entry.glAccount}</span>
                          <span className="col-bldg">{entry.bldgCode}</span>
                          <span className="col-profit">{entry.profitCenter}</span>
                          <span className="col-amount">{formatCurrency(entry.amount)}</span>
                        </div>
                      ))}
                      
                      {/* Dotted line */}
                      <div className="dotted-line"></div>
                      
                      {/* Subtotal */}
                      <div className="subtotal-row">
                        <span className="subtotal-label">TOTAL {profitCenter}</span>
                        <span className="subtotal-amount">{formatCurrency(subtotal)}</span>
                      </div>
                    </div>
                  );
                })}
                
                {/* Grand Total */}
                <div className="grand-total">
                  <div className="total-line"></div>
                  <div className="total-row">
                    <span className="total-label">TOTAL DEPRECIATION FOR THE MONTH</span>
                    <span className="total-amount">{formatCurrency(totalDepreciation)}</span>
                  </div>
                  <div className="total-line"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .print-page-container {
          display: flex;
          justify-content: center;
          padding: 20px;
          min-height: calc(100vh - 80px);
        }

        .print-page {
          width: 8.5in;
          min-height: 11in;
          background: hsl(var(--background));
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          padding: 0.75in;
          margin: 0 auto;
        }

        .page-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid hsl(var(--foreground));
          padding-bottom: 15px;
        }

        .business-unit-name {
          font-size: 20px;
          font-weight: bold;
          color: hsl(var(--foreground));
          margin: 0 0 8px 0;
          letter-spacing: 0.5px;
        }

        .report-title {
          font-size: 16px;
          font-weight: bold;
          margin: 6px 0;
          color: hsl(var(--foreground));
        }

        .report-subtitle {
          font-size: 12px;
          margin: 4px 0;
          color: hsl(var(--muted-foreground));
        }

        .report-period {
          font-size: 12px;
          margin: 6px 0 0 0;
          color: hsl(var(--muted-foreground));
        }

        .column-headers {
          margin-top: 25px;
        }

        .header-row {
          display: grid;
          grid-template-columns: 60px 80px 1fr 180px 80px 100px 100px;
          gap: 8px;
          padding: 8px 0;
          font-weight: bold;
          font-size: 11px;
          color: hsl(var(--foreground));
        }

        .schedule-body {
          margin-top: 10px;
        }

        .group-section {
          margin-bottom: 20px;
        }

        .group-header {
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 5px;
          color: hsl(var(--foreground));
        }

        .department-header {
          font-weight: bold;
          font-size: 11px;
          margin-bottom: 8px;
          color: hsl(var(--foreground));
        }

        .entry-row {
          display: grid;
          grid-template-columns: 60px 80px 1fr 180px 80px 100px 100px;
          gap: 8px;
          padding: 3px 0;
          font-size: 10px;
          color: hsl(var(--foreground));
        }

        .col-date, .col-code, .col-description, .col-gl, .col-bldg, .col-profit {
          text-align: left;
        }

        .col-amount {
          text-align: right;
          font-family: 'Courier New', monospace;
        }

        .dotted-line {
          height: 1px;
          border-bottom: 1px dotted hsl(var(--muted-foreground));
          margin: 8px 0;
        }

        .subtotal-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-weight: bold;
          font-size: 11px;
          color: hsl(var(--foreground));
        }

        .subtotal-amount {
          font-family: 'Courier New', monospace;
        }

        .grand-total {
          margin-top: 30px;
        }

        .total-line {
          height: 2px;
          background: hsl(var(--foreground));
          margin: 5px 0;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          font-weight: bold;
          font-size: 13px;
          color: hsl(var(--foreground));
        }

        .total-label {
          text-align: center;
          flex: 1;
        }

        .total-amount {
          font-family: 'Courier New', monospace;
          min-width: 100px;
          text-align: right;
        }

        .no-data {
          text-align: center;
          padding: 60px 20px;
          color: hsl(var(--muted-foreground));
        }

        .no-data h3 {
          font-size: 20px;
          margin-bottom: 10px;
          color: hsl(var(--foreground));
        }

        .no-data p {
          font-size: 14px;
        }

        @media print {
          .print-page-container {
            padding: 0;
          }

          .print-page {
            width: 100%;
            min-height: 100vh;
            box-shadow: none;
            margin: 0;
            padding: 0.75in;
            background: white !important;
            color: black !important;
          }

          .page-header {
            border-bottom: 2px solid black !important;
          }

          .business-unit-name, .report-title, .group-header, .department-header, .header-row, .entry-row, .subtotal-row, .total-row {
            color: black !important;
          }

          .dotted-line {
            border-bottom: 1px dotted #666 !important;
          }

          .total-line {
            background: black !important;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        @media screen and (max-width: 1400px) {
          .print-page {
            width: 95%;
            transform: scale(0.9);
            transform-origin: top center;
          }
        }

        @media screen and (max-width: 1024px) {
          .print-page {
            transform: scale(0.7);
          }

          .header-row, .entry-row {
            grid-template-columns: 50px 70px 1fr 150px 70px 80px 80px;
            gap: 6px;
          }
        }

        @media screen and (max-width: 768px) {
          .print-page {
            transform: scale(0.5);
          }

          .header-row, .entry-row {
            grid-template-columns: 40px 60px 1fr 120px 60px 70px 70px;
            gap: 4px;
            font-size: 9px;
          }
        }
      `}</style>
    </div>
  );
}