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
import { DamagedLossReportData } from "@/lib/actions/damaged-loss-reports-actions";
import { toast } from "sonner";

interface DamagedLossPreviewProps {
  reportData: DamagedLossReportData[];
  businessUnit: {
    id: string;
    name: string;
  };
  filters: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    departmentId?: string;
    status?: string;
    disposalReason?: string;
    includeDisposed?: boolean;
  };
}

interface TransactionGroup {
  transNo: string;
  date: string;
  assets: {
    seq: number;
    assetCode: string;
    description: string;
    currentQty: number;
    currentBV: number;
    qtyDisposed: number;
    amount: number;
    remarks: string;
  }[];
  subtotal: number;
}

export function DamagedLossPreview({
  reportData,
  businessUnit,
  filters
}: DamagedLossPreviewProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Generate transaction groups from report data
  const generateTransactionGroups = (): TransactionGroup[] => {
    const groups: TransactionGroup[] = [];
    let transactionCounter = 1;
    
    // Group assets by disposal date or status change date
    const assetsByDate = new Map<string, DamagedLossReportData[]>();
    
    reportData.forEach(asset => {
      const dateKey = asset.disposal?.disposalDate 
        ? format(new Date(asset.disposal.disposalDate), 'MM/dd/yyyy')
        : asset.lastHistoryEntry?.actionDate 
          ? format(new Date(asset.lastHistoryEntry.actionDate), 'MM/dd/yyyy')
          : format(new Date(), 'MM/dd/yyyy');
      
      if (!assetsByDate.has(dateKey)) {
        assetsByDate.set(dateKey, []);
      }
      assetsByDate.get(dateKey)!.push(asset);
    });

    // Convert to transaction groups
    Array.from(assetsByDate.entries()).forEach(([date, assets]) => {
      const transNo = `${String(transactionCounter).padStart(6, '0')}`;
      
      const groupAssets = assets.map((asset, index) => ({
        seq: index + 1,
        assetCode: asset.itemCode,
        description: asset.description,
        currentQty: 1.00,
        currentBV: asset.currentBookValue || 0,
        qtyDisposed: 1.00,
        amount: asset.disposal?.gainLoss 
          ? Math.abs(asset.disposal.gainLoss)
          : (asset.currentBookValue || 0),
        remarks: asset.status === 'DISPOSED' 
          ? `${asset.disposal?.reason?.replace('_', ' ') || 'Disposed'}`
          : asset.status === 'LOST' 
            ? 'Lost'
            : asset.status === 'DAMAGED'
              ? 'Damaged'
              : asset.status
      }));

      const subtotal = groupAssets.reduce((sum, item) => sum + item.amount, 0);

      groups.push({
        transNo,
        date,
        assets: groupAssets,
        subtotal
      });

      transactionCounter++;
    });

    return groups.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
    handlePrint();
  };

  const handleBack = () => {
    router.back();
  };

  const transactionGroups = generateTransactionGroups();
  const grandTotal = transactionGroups.reduce((sum, group) => sum + group.subtotal, 0);

  const generatePrintHTML = () => {
    const reportDate = format(new Date(), 'MMMM dd, yyyy');
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lost, Damaged, Worn-Out and Sold-Out Assets Register - ${businessUnit.name}</title>
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
              font-size: 12px;
              line-height: 1.3;
            }
            
            .page-header {
              text-align: center;
              margin-bottom: 25px;
              padding-bottom: 15px;
            }
            
            .business-unit-name {
              font-size: 18px;
              font-weight: bold;
              color: #000;
              margin: 0 0 5px 0;
              letter-spacing: 0.5px;
            }
            
            .business-address {
              font-size: 11px;
              color: #000;
              margin: 0 0 8px 0;
            }
            
            .report-title {
              font-size: 14px;
              font-weight: bold;
              margin: 8px 0 5px 0;
              color: #000;
            }
            
            .report-date {
              font-size: 11px;
              margin: 5px 0 0 0;
              color: #000;
            }
            
            .content-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 11px;
            }
            
            .header-row {
              border-top: 2px solid #000;
              border-bottom: 2px solid #000;
            }
            
            .header-row td {
              padding: 6px 4px;
              font-weight: bold;
              font-size: 10px;
              text-align: center;
              color: #000;
            }
            
            .header-row td.left-align {
              text-align: left;
            }
            
            .header-row td.right-align {
              text-align: right;
            }
            
            .trans-header {
              font-weight: bold;
              font-size: 10px;
              padding: 4px 3px;
              vertical-align: top;
              color: #000;
            }
            
            .asset-row td {
              padding: 3px 4px;
              font-size: 10px;
              vertical-align: top;
              color: #000;
            }
            
            .subtotal-row {
              border-top: 1px solid #000;
              font-weight: bold;
            }
            
            .subtotal-row td {
              padding: 4px;
              font-size: 10px;
              color: #000;
            }
            
            .amount-cell {
              text-align: right;
              font-family: 'Courier New', monospace;
            }
            
            .center {
              text-align: center;
            }
            
            .right {
              text-align: right;
            }
            
            .left-align {
              text-align: left;
            }
            
            .page-footer {
              margin-top: 20px;
              text-align: right;
              font-size: 10px;
              color: #000;
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
            <div class="business-unit-name">${businessUnit.name.toUpperCase()}</div>
            <div class="business-address">General Santos Business Park, National Highway, Gen. Santos City</div>
            <div class="report-title">LOST, DAMAGED, WORN-OUT AND SOLD-OUT ASSETS REGISTER</div>
            <div class="report-date">As of ${reportDate}</div>
          </div>
          
          <table class="content-table">
            <tr class="header-row">
              <td style="width: 10%;" class="left-align">Trans Date</td>
              <td style="width: 5%;">Seq #</td>
              <td style="width: 10%;" class="left-align">Asset Code</td>
              <td style="width: 30%;" class="left-align">Asset</td>
              <td style="width: 8%;" class="right-align">Current Qty</td>
              <td style="width: 12%;" class="right-align">Current BV</td>
              <td style="width: 8%;" class="right-align">Qty Disp</td>
              <td style="width: 10%;" class="right-align">Amount</td>
              <td style="width: 7%;" class="left-align">Remarks</td>
            </tr>
            
            ${transactionGroups.map(group => `
              ${group.assets.map((asset, index) => `
                <tr class="asset-row">
                  ${index === 0 ? `
                    <td rowspan="${group.assets.length}" class="trans-header">
                      <strong>Trans No: ${group.transNo}</strong><br>
                      ${group.date}
                    </td>
                  ` : ''}
                  <td class="center">${asset.seq}</td>
                  <td class="left-align">${asset.assetCode}</td>
                  <td class="left-align">${asset.description}</td>
                  <td class="amount-cell">${formatCurrency(asset.currentQty)}</td>
                  <td class="amount-cell">${formatCurrency(asset.currentBV)}</td>
                  <td class="amount-cell">${formatCurrency(asset.qtyDisposed)}</td>
                  <td class="amount-cell">${formatCurrency(asset.amount)}</td>
                  <td class="left-align">${asset.remarks}</td>
                </tr>
              `).join('')}
              <tr class="subtotal-row">
                <td colspan="7" class="right"><strong>SUB-TOTAL</strong></td>
                <td class="amount-cell"><strong>${formatCurrency(group.subtotal)}</strong></td>
                <td></td>
              </tr>
            `).join('')}
          </table>
          
          <div class="page-footer">
            Page 1 of 1
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
                Damaged & Loss Report Preview
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleDownload}
                disabled={reportData.length === 0}
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                onClick={handlePrint}
                disabled={reportData.length === 0}
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
            <div className="business-address">General Santos Business Park, National Highway, Gen. Santos City</div>
            <div className="report-title">LOST, DAMAGED, WORN-OUT AND SOLD-OUT ASSETS REGISTER</div>
            <div className="report-date">As of {format(new Date(), 'MMMM dd, yyyy')}</div>
          </div>

          {reportData.length === 0 ? (
            <div className="no-data">
              <h3>No Damaged or Lost Assets</h3>
              <p>No assets found matching the selected criteria for the specified period.</p>
            </div>
          ) : (
            <div className="content-table-container">
              <table className="content-table">
                <thead>
                  <tr className="header-row">
                    <th style={{width: '10%'}} className="left-align">Trans Date</th>
                    <th style={{width: '5%'}}>Seq #</th>
                    <th style={{width: '10%'}} className="left-align">Asset Code</th>
                    <th style={{width: '30%'}} className="left-align">Asset</th>
                    <th style={{width: '8%'}} className="right-align">Current Qty</th>
                    <th style={{width: '12%'}} className="right-align">Current BV</th>
                    <th style={{width: '8%'}} className="right-align">Qty Disp</th>
                    <th style={{width: '10%'}} className="right-align">Amount</th>
                    <th style={{width: '7%'}} className="left-align">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionGroups.map((group, groupIndex) => (
                    <React.Fragment key={groupIndex}>
                      {group.assets.map((asset, assetIndex) => (
                        <tr key={`${groupIndex}-${assetIndex}`} className="asset-row">
                          {assetIndex === 0 && (
                            <td rowSpan={group.assets.length} className="trans-header">
                              <div className="trans-no"><strong>Trans No: {group.transNo}</strong></div>
                              <div className="trans-date">{group.date}</div>
                            </td>
                          )}
                          <td className="center">{asset.seq}</td>
                          <td className="left-align">{asset.assetCode}</td>
                          <td className="left-align">{asset.description}</td>
                          <td className="amount-cell">{formatCurrency(asset.currentQty)}</td>
                          <td className="amount-cell">{formatCurrency(asset.currentBV)}</td>
                          <td className="amount-cell">{formatCurrency(asset.qtyDisposed)}</td>
                          <td className="amount-cell">{formatCurrency(asset.amount)}</td>
                          <td className="left-align">{asset.remarks}</td>
                        </tr>
                      ))}
                      <tr className="subtotal-row">
                        <td colSpan={7} className="subtotal-label"><strong>SUB-TOTAL</strong></td>
                        <td className="amount-cell"><strong>{formatCurrency(group.subtotal)}</strong></td>
                        <td></td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              
              <div className="page-footer">
                Page 1 of 1
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
          padding: 0.5in;
          margin: 0 auto;
        }

        .page-header {
          text-align: center;
          margin-bottom: 25px;
          padding-bottom: 15px;
        }

        .business-unit-name {
          font-size: 18px;
          font-weight: bold;
          color: hsl(var(--foreground));
          margin: 0 0 5px 0;
          letter-spacing: 0.5px;
        }

        .business-address {
          font-size: 11px;
          color: hsl(var(--foreground));
          margin: 0 0 8px 0;
        }

        .report-title {
          font-size: 14px;
          font-weight: bold;
          margin: 8px 0 5px 0;
          color: hsl(var(--foreground));
        }

        .report-date {
          font-size: 11px;
          margin: 5px 0 0 0;
          color: hsl(var(--foreground));
        }

        .content-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          font-size: 11px;
        }

        .header-row th {
          border-top: 2px solid hsl(var(--foreground));
          border-bottom: 2px solid hsl(var(--foreground));
          padding: 6px 4px;
          font-weight: bold;
          font-size: 10px;
          text-align: center;
          color: hsl(var(--foreground));
        }
        
        .header-row th.left-align {
          text-align: left;
        }
        
        .header-row th.right-align {
          text-align: right;
        }

        .trans-header {
          font-weight: bold;
          font-size: 10px;
          padding: 4px 3px;
          vertical-align: top;
          color: hsl(var(--foreground));
        }

        .trans-no {
          margin-bottom: 2px;
          font-weight: bold;
        }

        .trans-date {
          font-size: 10px;
        }

        .asset-row td {
          padding: 3px 4px;
          font-size: 10px;
          vertical-align: top;
          color: hsl(var(--foreground));
        }

        .subtotal-row {
          border-top: 1px solid hsl(var(--foreground));
        }

        .subtotal-row td {
          padding: 4px;
          font-size: 10px;
          font-weight: bold;
          color: hsl(var(--foreground));
        }

        .subtotal-label {
          text-align: right;
        }

        .amount-cell {
          text-align: right;
          font-family: 'Courier New', monospace;
        }

        .center {
          text-align: center;
        }
        
        .left-align {
          text-align: left;
        }

        .page-footer {
          margin-top: 20px;
          text-align: right;
          font-size: 10px;
          color: hsl(var(--foreground));
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
            padding: 0.5in;
            background: white !important;
            color: black !important;
          }

          .page-header {
            border-bottom: 2px solid black !important;
          }

          .business-unit-name, .report-title, .trans-header, .header-row th, .asset-row td, .subtotal-row td {
            color: black !important;
          }

          .business-address, .report-date, .page-footer {
            color: #666 !important;
          }

          .header-row th {
            border-top: 1px solid black !important;
            border-bottom: 1px solid black !important;
          }

          .subtotal-row {
            border-top: 1px solid black !important;
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
        }

        @media screen and (max-width: 768px) {
          .print-page {
            transform: scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}