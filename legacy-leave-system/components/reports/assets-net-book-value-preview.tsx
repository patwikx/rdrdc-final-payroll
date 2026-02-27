"use client";

import React from "react";
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

interface AssetsNetBookValuePreviewProps {
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

interface AssetNetBookEntry {
  assetCode: string;
  assetDescription: string;
  dateAcquired: string;
  accumulatedCost: number;
  accumulatedDepreciation: number;
  usefulLifeRemainingMonths: number | null;
  netBookValue: number;
  monthlyDepreciation: number;
  department: string;
}

export function AssetsNetBookValuePreview({
  analysisData,
  businessUnit,
  filters
}: AssetsNetBookValuePreviewProps) {
  const router = useRouter();

  // Filter assets that have complete financial data
  const assetsWithFinancialData = analysisData.filter(asset => 
    asset.purchasePrice && 
    asset.purchaseDate &&
    asset.currentBookValue !== null &&
    asset.accumulatedDepreciation !== null
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Generate net book value entries grouped by GL Account
  const generateNetBookValueEntries = (): Map<string, AssetNetBookEntry[]> => {
    const entriesByGLAccount = new Map<string, AssetNetBookEntry[]>();
    
    assetsWithFinancialData.forEach(asset => {
      const glAccount = `${asset.category.name} Assets`;
      
      if (!entriesByGLAccount.has(glAccount)) {
        entriesByGLAccount.set(glAccount, []);
      }
      
      // Calculate remaining useful life in months
      const calculateRemainingMonths = () => {
        const totalLifeMonths = (asset.usefulLifeYears || 0) * 12 + (asset.usefulLifeMonths || 0);
        const currentDate = new Date();
        const startDate = asset.depreciationStartDate ? new Date(asset.depreciationStartDate) : null;
        
        if (!startDate || totalLifeMonths === 0) {
          return null;
        }
        
        // Calculate months elapsed since depreciation started in the system
        const monthsElapsedInSystem = Math.max(0, 
          (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
          (currentDate.getMonth() - startDate.getMonth())
        );
        
        // Add prior depreciation months (months depreciated before system entry)
        const totalMonthsDepreciated = monthsElapsedInSystem + (asset.priorDepreciationMonths || 0);
        
        return Math.max(0, totalLifeMonths - totalMonthsDepreciated);
      };

      entriesByGLAccount.get(glAccount)!.push({
        assetCode: asset.itemCode,
        assetDescription: asset.description,
        dateAcquired: format(new Date(asset.purchaseDate!), 'MM/dd/yyyy'),
        accumulatedCost: Number(asset.purchasePrice),
        accumulatedDepreciation: Number(asset.accumulatedDepreciation),
        usefulLifeRemainingMonths: calculateRemainingMonths(),
        netBookValue: Number(asset.currentBookValue),
        monthlyDepreciation: Number(asset.monthlyDepreciation || 0),
        department: asset.department?.name || 'General'
      });
    });

    return entriesByGLAccount;
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

  const entriesByGLAccount = generateNetBookValueEntries();
  const totalAccumulatedCost = assetsWithFinancialData.reduce((sum, asset) => sum + Number(asset.purchasePrice), 0);
  const totalAccumulatedDepreciation = assetsWithFinancialData.reduce((sum, asset) => sum + Number(asset.accumulatedDepreciation), 0);
  const totalNetBookValue = assetsWithFinancialData.reduce((sum, asset) => sum + Number(asset.currentBookValue), 0);

  const generatePrintHTML = () => {
    const reportDate = format(new Date(), 'MMMM dd, yyyy');
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Assets Net Book Value - ${businessUnit.name}</title>
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
            
            .report-date {
              font-size: 12px;
              margin: 4px 0 0 0;
              color: #666;
            }
            
            .schedule-content {
              margin-top: 20px;
            }
            
            .column-headers {
              display: grid;
              grid-template-columns: 80px 1fr 80px 100px 120px 80px 100px 100px;
              gap: 8px;
              padding: 8px 0;
              font-weight: bold;
              font-size: 11px;
              margin-bottom: 10px;
            }
            
            .column-headers span:nth-child(3),
            .column-headers span:nth-child(4),
            .column-headers span:nth-child(5),
            .column-headers span:nth-child(6),
            .column-headers span:nth-child(7),
            .column-headers span:nth-child(8) {
              text-align: right;
            }
            
            .group-section {
              margin-bottom: 20px;
            }
            
            .group-header {
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 8px;
            }
            
            .entry-row {
              display: grid;
              grid-template-columns: 80px 1fr 80px 100px 120px 80px 100px 100px;
              gap: 8px;
              padding: 3px 0;
              font-size: 10px;
            }
            
            .col-amount {
              text-align: right;
              font-family: 'Courier New', monospace;
            }
            
            .subtotal-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              font-weight: bold;
              font-size: 11px;
              margin-top: 8px;
            }
            
            .subtotal-amounts {
              display: grid;
              grid-template-columns: 100px 120px 80px 100px;
              gap: 8px;
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
            
            .total-amounts {
              display: grid;
              grid-template-columns: 100px 120px 80px 100px;
              gap: 8px;
              font-family: 'Courier New', monospace;
              font-size: 13px;
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
            <div class="report-title">ASSETS NET BOOK VALUE</div>
            <div class="report-date">AS OF ${reportDate.toUpperCase()}</div>
          </div>
          
          <div class="schedule-content">
            <!-- Column Headers -->
            <div class="column-headers">
              <span>Asset Code</span>
              <span>Asset Description</span>
              <span>Date Acquired</span>
              <span>Accumulated Cost</span>
              <span>Accumulated Depreciation</span>
              <span>Useful Life Remaining (Months)</span>
              <span>Net Book Value</span>
              <span>Monthly Depreciation</span>
            </div>

            <!-- Schedule Body -->
            ${Array.from(entriesByGLAccount.entries()).map(([glAccount, entries]) => {
              const subtotalCost = entries.reduce((sum, entry) => sum + entry.accumulatedCost, 0);
              const subtotalDepreciation = entries.reduce((sum, entry) => sum + entry.accumulatedDepreciation, 0);
              const subtotalNetBook = entries.reduce((sum, entry) => sum + entry.netBookValue, 0);
              
              return `
                <div class="group-section">
                  <!-- GL Account Header -->
                  <div class="group-header">${glAccount}</div>
                  
                  <!-- Entries -->
                  ${entries.map(entry => `
                    <div class="entry-row">
                      <span>${entry.assetCode}</span>
                      <span>${entry.assetDescription}</span>
                      <span class="col-amount">${entry.dateAcquired}</span>
                      <span class="col-amount">${formatCurrency(entry.accumulatedCost)}</span>
                      <span class="col-amount">${formatCurrency(entry.accumulatedDepreciation)}</span>
                      <span class="col-amount">${entry.usefulLifeRemainingMonths !== null ? entry.usefulLifeRemainingMonths + ' months' : 'N/A'}</span>
                      <span class="col-amount">${formatCurrency(entry.netBookValue)}</span>
                      <span class="col-amount">${formatCurrency(entry.monthlyDepreciation)}</span>
                    </div>
                  `).join('')}
                  
                  <!-- Subtotal -->
                  <div class="subtotal-row">
                    <span>TOTAL ${glAccount}</span>
                    <div class="subtotal-amounts">
                      <span class="col-amount">${formatCurrency(subtotalCost)}</span>
                      <span class="col-amount">${formatCurrency(subtotalDepreciation)}</span>
                      <span class="col-amount">—</span>
                      <span class="col-amount">${formatCurrency(subtotalNetBook)}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
            
            <!-- Grand Total -->
            <div class="grand-total">
              <div class="total-line"></div>
              <div class="total-row">
                <span class="total-label">TOTAL ASSETS NET BOOK VALUE</span>
                <div class="total-amounts">
                  <span class="col-amount">${formatCurrency(totalAccumulatedCost)}</span>
                  <span class="col-amount">${formatCurrency(totalAccumulatedDepreciation)}</span>
                  <span class="col-amount">—</span>
                  <span class="col-amount">${formatCurrency(totalNetBookValue)}</span>
                </div>
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
                Assets Net Book Value Report Preview
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleDownload}
                disabled={assetsWithFinancialData.length === 0}
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                onClick={handlePrint}
                disabled={assetsWithFinancialData.length === 0}
                size="lg"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Print Content */}
      <div className="print-page-container">
        <div className="print-page">
          {/* Header */}
          <div className="page-header">
            <h1 className="business-unit-name">{businessUnit.name.toUpperCase()}</h1>
            <div className="report-title">ASSETS NET BOOK VALUE</div>
            <div className="report-date">AS OF {format(new Date(), 'MMMM dd, yyyy').toUpperCase()}</div>
          </div>

          {assetsWithFinancialData.length === 0 ? (
            <div className="no-data">
              <h3>No Asset Data Available</h3>
              <p>No assets found with complete financial information for the selected criteria.</p>
            </div>
          ) : (
            <div className="schedule-content">
              {/* Column Headers */}
              <div className="column-headers">
                <div className="header-row">
                  <span className="col-code">Asset Code</span>
                  <span className="col-description">Asset Description</span>
                  <span className="col-date">Date Acquired</span>
                  <span className="col-cost-header">Accumulated Cost</span>
                  <span className="col-depreciation-header">Accumulated Depreciation</span>
                  <span className="col-remaining-header">Useful Life Remaining (Months)</span>
                  <span className="col-netbook-header">Net Book Value</span>
                  <span className="col-monthly-header">Monthly Depreciation</span>
                </div>
              </div>

              {/* Schedule Content */}
              <div className="schedule-body">
                {Array.from(entriesByGLAccount.entries()).map(([glAccount, entries]) => {
                  const subtotalCost = entries.reduce((sum, entry) => sum + entry.accumulatedCost, 0);
                  const subtotalDepreciation = entries.reduce((sum, entry) => sum + entry.accumulatedDepreciation, 0);
                  const subtotalNetBook = entries.reduce((sum, entry) => sum + entry.netBookValue, 0);
                  
                  return (
                    <div key={glAccount} className="group-section">
                      {/* GL Account Header */}
                      <div className="group-header">
                        <strong>{glAccount}</strong>
                      </div>
                      
                      {/* Entries */}
                      {entries.map((entry, index) => (
                        <div key={`${glAccount}-${index}`} className="entry-row">
                          <span className="col-code">{entry.assetCode}</span>
                          <span className="col-description">{entry.assetDescription}</span>
                          <span className="col-date">{entry.dateAcquired}</span>
                          <span className="col-cost">{formatCurrency(entry.accumulatedCost)}</span>
                          <span className="col-depreciation">{formatCurrency(entry.accumulatedDepreciation)}</span>
                          <span className="col-remaining">
                            {entry.usefulLifeRemainingMonths !== null 
                              ? `${entry.usefulLifeRemainingMonths} months` 
                              : 'N/A'
                            }
                          </span>
                          <span className="col-netbook">{formatCurrency(entry.netBookValue)}</span>
                          <span className="col-monthly">{formatCurrency(entry.monthlyDepreciation)}</span>
                        </div>
                      ))}
                      
                      {/* Subtotal */}
                      <div className="subtotal-row">
                        <span className="subtotal-label">TOTAL {glAccount}</span>
                        <div className="subtotal-amounts">
                          <span className="subtotal-cost">{formatCurrency(subtotalCost)}</span>
                          <span className="subtotal-depreciation">{formatCurrency(subtotalDepreciation)}</span>
                          <span className="subtotal-remaining">—</span>
                          <span className="subtotal-netbook">{formatCurrency(subtotalNetBook)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Grand Total */}
                <div className="grand-total">
                  <div className="total-line"></div>
                  <div className="total-row">
                    <span className="total-label">TOTAL ASSETS NET BOOK VALUE</span>
                    <div className="total-amounts">
                      <span className="total-cost">{formatCurrency(totalAccumulatedCost)}</span>
                      <span className="total-depreciation">{formatCurrency(totalAccumulatedDepreciation)}</span>
                      <span className="total-remaining">—</span>
                      <span className="total-netbook">{formatCurrency(totalNetBookValue)}</span>
                    </div>
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
          width: 14in;
          min-height: 8.5in;
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

        .report-date {
          font-size: 12px;
          margin: 6px 0 0 0;
          color: hsl(var(--muted-foreground));
        }

        .column-headers {
          margin-top: 25px;
        }

        .header-row {
          display: grid;
          grid-template-columns: 80px 1fr 80px 100px 120px 80px 100px 100px;
          gap: 8px;
          padding: 8px 0;
          font-weight: bold;
          font-size: 11px;
          color: hsl(var(--foreground));
        }

        .col-date, .col-cost-header, .col-depreciation-header, .col-remaining-header, .col-netbook-header, .col-monthly-header {
          text-align: right;
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
          margin-bottom: 8px;
          color: hsl(var(--foreground));
        }

        .entry-row {
          display: grid;
          grid-template-columns: 80px 1fr 80px 100px 120px 80px 100px 100px;
          gap: 8px;
          padding: 3px 0;
          font-size: 10px;
          color: hsl(var(--foreground));
        }

        .col-date, .col-cost, .col-depreciation, .col-remaining, .col-netbook, .col-monthly {
          text-align: right;
          font-family: 'Courier New', monospace;
        }

        .subtotal-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-weight: bold;
          font-size: 11px;
          color: hsl(var(--foreground));
          margin-top: 8px;
        }

        .subtotal-amounts {
          display: grid;
          grid-template-columns: 100px 120px 80px 100px;
          gap: 8px;
        }

        .subtotal-cost, .subtotal-depreciation, .subtotal-remaining, .subtotal-netbook {
          text-align: right;
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

        .total-amounts {
          display: grid;
          grid-template-columns: 100px 120px 80px 100px;
          gap: 8px;
        }

        .total-cost, .total-depreciation, .total-remaining, .total-netbook {
          text-align: right;
          font-family: 'Courier New', monospace;
          font-size: 13px;
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

          .business-unit-name, .report-title, .group-header, .header-row, .entry-row, .subtotal-row, .total-row {
            color: black !important;
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
            grid-template-columns: 70px 1fr 70px 90px 110px 70px 90px 90px;
            gap: 6px;
          }

          .subtotal-amounts, .total-amounts {
            grid-template-columns: 90px 110px 70px 90px;
            gap: 6px;
          }
        }

        @media screen and (max-width: 768px) {
          .print-page {
            transform: scale(0.5);
          }

          .header-row, .entry-row {
            grid-template-columns: 60px 1fr 60px 80px 100px 60px 80px 80px;
            gap: 4px;
            font-size: 9px;
          }

          .subtotal-amounts, .total-amounts {
            grid-template-columns: 80px 100px 60px 80px;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}