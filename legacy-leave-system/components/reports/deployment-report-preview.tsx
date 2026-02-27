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
import { DeploymentReportData, DeploymentReportFilters } from "@/lib/actions/deployment-reports-actions";
import { DeploymentStatus } from "@prisma/client";
import { toast } from "sonner";

interface DeploymentReportPreviewProps {
  reportData: DeploymentReportData[];
  businessUnit: {
    id: string;
    name: string;
  };
  filters: DeploymentReportFilters;
}

interface DeploymentEntry {
  transmittalNumber: string;
  assetCode: string;
  assetDescription: string;
  serialNumber: string;
  employeeName: string;
  employeeId: string;
  department: string;
  deployedDate: string;
  expectedReturnDate: string;
  returnedDate: string;
  status: string;
  assetValue: number;
  deploymentCondition: string;
  returnCondition: string;
}

const STATUS_LABELS: Record<string, string> = {
  [DeploymentStatus.PENDING_ACCOUNTING_APPROVAL]: "Pending Approval",
  [DeploymentStatus.DEPLOYED]: "Deployed",
  [DeploymentStatus.RETURNED]: "Returned",
  // Add other possible statuses
  APPROVED: "Approved",
};

export function DeploymentReportPreview({
  reportData,
  businessUnit,
  filters
}: DeploymentReportPreviewProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Generate deployment entries grouped by department
  const generateDeploymentEntries = (): Map<string, DeploymentEntry[]> => {
    const entriesByDepartment = new Map<string, DeploymentEntry[]>();
    
    reportData.forEach(deployment => {
      const department = deployment.employee.department?.name || 'No Department';
      
      if (!entriesByDepartment.has(department)) {
        entriesByDepartment.set(department, []);
      }
      
      entriesByDepartment.get(department)!.push({
        transmittalNumber: deployment.transmittalNumber,
        assetCode: deployment.asset.itemCode,
        assetDescription: deployment.asset.description,
        serialNumber: deployment.asset.serialNumber || 'N/A',
        employeeName: deployment.employee.name,
        employeeId: deployment.employee.employeeId,
        department: deployment.employee.department?.name || 'No Department',
        deployedDate: deployment.deployedDate ? format(new Date(deployment.deployedDate), 'MM/dd/yyyy') : 'Not deployed',
        expectedReturnDate: deployment.expectedReturnDate ? format(new Date(deployment.expectedReturnDate), 'MM/dd/yyyy') : 'N/A',
        returnedDate: deployment.returnedDate ? format(new Date(deployment.returnedDate), 'MM/dd/yyyy') : 'Not returned',
        status: STATUS_LABELS[deployment.status] || deployment.status,
        assetValue: deployment.asset.currentBookValue || deployment.asset.purchasePrice || 0,
        deploymentCondition: deployment.deploymentCondition || 'N/A',
        returnCondition: deployment.returnCondition || 'N/A',
      });
    });

    return entriesByDepartment;
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

  const entriesByDepartment = generateDeploymentEntries();
  const totalDeployments = reportData.length;
  const totalAssetValue = reportData.reduce((sum, deployment) => 
    sum + (deployment.asset.currentBookValue || deployment.asset.purchasePrice || 0), 0
  );
  const activeDeployments = reportData.filter(d => d.status === DeploymentStatus.DEPLOYED && !d.returnedDate).length;

  const generateFilterSummary = () => {
    const filterParts = [];
    
    if (filters.startDate && filters.endDate) {
      filterParts.push(`Period: ${format(filters.startDate, 'MMM dd, yyyy')} - ${format(filters.endDate, 'MMM dd, yyyy')}`);
    } else if (filters.startDate) {
      filterParts.push(`From: ${format(filters.startDate, 'MMM dd, yyyy')}`);
    } else if (filters.endDate) {
      filterParts.push(`Until: ${format(filters.endDate, 'MMM dd, yyyy')}`);
    }
    
    if (filters.status) {
      filterParts.push(`Status: ${STATUS_LABELS[filters.status] || filters.status}`);
    }
    
    if (!filters.includeReturned) {
      filterParts.push('Excluding returned assets');
    }
    
    return filterParts.length > 0 ? filterParts.join(' | ') : 'All deployments';
  };

  const generatePrintHTML = () => {
    const reportDate = format(new Date(), 'MMMM dd, yyyy');
    const filterSummary = generateFilterSummary();
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Deployment Report - ${businessUnit.name}</title>
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
              font-size: 10px;
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
            
            .filter-summary {
              font-size: 11px;
              margin: 8px 0 0 0;
              color: #666;
              font-style: italic;
            }
            
            .summary-stats {
              display: flex;
              justify-content: space-around;
              margin: 20px 0;
              padding: 10px;
              background: #f5f5f5;
              border-radius: 5px;
            }
            
            .stat-item {
              text-align: center;
            }
            
            .stat-value {
              font-size: 16px;
              font-weight: bold;
              color: #000;
            }
            
            .stat-label {
              font-size: 10px;
              color: #666;
              margin-top: 2px;
            }
            
            .schedule-content {
              margin-top: 20px;
            }
            
            .column-headers {
              display: grid;
              grid-template-columns: 80px 80px 1fr 80px 100px 80px 80px 80px 80px 80px 100px;
              gap: 6px;
              padding: 8px 0;
              font-weight: bold;
              font-size: 9px;
              margin-bottom: 10px;
              background: #f0f0f0;
              border-radius: 3px;
            }
            
            .column-headers span:nth-child(7),
            .column-headers span:nth-child(8),
            .column-headers span:nth-child(9),
            .column-headers span:nth-child(10),
            .column-headers span:nth-child(11) {
              text-align: right;
            }
            
            .group-section {
              margin-bottom: 20px;
            }
            
            .group-header {
              font-weight: bold;
              font-size: 11px;
              margin-bottom: 8px;
              background: #e8e8e8;
              padding: 5px;
              border-radius: 3px;
            }
            
            .entry-row {
              display: grid;
              grid-template-columns: 80px 80px 1fr 80px 100px 80px 80px 80px 80px 80px 100px;
              gap: 6px;
              padding: 3px 0;
              font-size: 8px;
              border-bottom: 1px solid #eee;
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
              font-size: 10px;
              margin-top: 8px;
              background: #f8f8f8;
              border-radius: 3px;
              padding: 5px;
            }
            
            .subtotal-amounts {
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
              font-size: 12px;
            }
            
            .total-label {
              text-align: center;
              flex: 1;
            }
            
            .total-amounts {
              font-family: 'Courier New', monospace;
              font-size: 12px;
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
            <div class="report-title">ASSET DEPLOYMENT REPORT</div>
            <div class="report-date">AS OF ${reportDate.toUpperCase()}</div>
            <div class="filter-summary">${filterSummary}</div>
          </div>
          
          <!-- Summary Statistics -->
          <div class="summary-stats">
            <div class="stat-item">
              <div class="stat-value">${totalDeployments}</div>
              <div class="stat-label">Total Deployments</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${activeDeployments}</div>
              <div class="stat-label">Active Deployments</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">₱${formatCurrency(totalAssetValue)}</div>
              <div class="stat-label">Total Asset Value</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${entriesByDepartment.size}</div>
              <div class="stat-label">Departments</div>
            </div>
          </div>
          
          <div class="schedule-content">
            <!-- Column Headers -->
            <div class="column-headers">
              <span>Transmittal #</span>
              <span>Asset Code</span>
              <span>Asset Description</span>
              <span>Serial #</span>
              <span>Employee</span>
              <span>Employee ID</span>
              <span>Deployed</span>
              <span>Expected Return</span>
              <span>Returned</span>
              <span>Status</span>
              <span>Asset Value</span>
            </div>

            <!-- Schedule Body -->
            ${Array.from(entriesByDepartment.entries()).map(([department, entries]) => {
              const subtotalValue = entries.reduce((sum, entry) => sum + entry.assetValue, 0);
              
              return `
                <div class="group-section">
                  <!-- Department Header -->
                  <div class="group-header">${department} (${entries.length} deployments)</div>
                  
                  <!-- Entries -->
                  ${entries.map(entry => `
                    <div class="entry-row">
                      <span>${entry.transmittalNumber}</span>
                      <span>${entry.assetCode}</span>
                      <span>${entry.assetDescription}</span>
                      <span>${entry.serialNumber}</span>
                      <span>${entry.employeeName}</span>
                      <span>${entry.employeeId}</span>
                      <span class="col-amount">${entry.deployedDate}</span>
                      <span class="col-amount">${entry.expectedReturnDate}</span>
                      <span class="col-amount">${entry.returnedDate}</span>
                      <span>${entry.status}</span>
                      <span class="col-amount">₱${formatCurrency(entry.assetValue)}</span>
                    </div>
                  `).join('')}
                  
                  <!-- Subtotal -->
                  <div class="subtotal-row">
                    <span>TOTAL ${department}</span>
                    <div class="subtotal-amounts">
                      ${entries.length} deployments - ₱${formatCurrency(subtotalValue)}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
            
            <!-- Grand Total -->
            <div class="grand-total">
              <div class="total-line"></div>
              <div class="total-row">
                <span class="total-label">TOTAL ASSET DEPLOYMENTS</span>
                <div class="total-amounts">
                  ${totalDeployments} deployments - ₱${formatCurrency(totalAssetValue)}
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
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
              <div className="text-sm text-muted-foreground">
                Asset Deployment Report Preview
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
            <div className="report-title">ASSET DEPLOYMENT REPORT</div>
            <div className="report-date">AS OF {format(new Date(), 'MMMM dd, yyyy').toUpperCase()}</div>
            <div className="filter-summary">{generateFilterSummary()}</div>
          </div>

          {/* Summary Statistics */}
          <div className="summary-stats">
            <div className="stat-item">
              <div className="stat-value">{totalDeployments}</div>
              <div className="stat-label">Total Deployments</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{activeDeployments}</div>
              <div className="stat-label">Active Deployments</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">₱{formatCurrency(totalAssetValue)}</div>
              <div className="stat-label">Total Asset Value</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{entriesByDepartment.size}</div>
              <div className="stat-label">Departments</div>
            </div>
          </div>

          {reportData.length === 0 ? (
            <div className="no-data">
              <h3>No Deployment Data Available</h3>
              <p>No deployments found for the selected criteria.</p>
            </div>
          ) : (
            <div className="schedule-content">
              {/* Column Headers */}
              <div className="column-headers">
                <div className="header-row">
                  <span className="col-transmittal">Transmittal #</span>
                  <span className="col-asset-code">Asset Code</span>
                  <span className="col-description">Asset Description</span>
                  <span className="col-serial">Serial #</span>
                  <span className="col-employee">Employee</span>
                  <span className="col-emp-id">Employee ID</span>
                  <span className="col-deployed">Deployed</span>
                  <span className="col-expected">Expected Return</span>
                  <span className="col-returned">Returned</span>
                  <span className="col-status">Status</span>
                  <span className="col-value">Asset Value</span>
                </div>
              </div>

              {/* Schedule Content */}
              <div className="schedule-body">
                {Array.from(entriesByDepartment.entries()).map(([department, entries]) => {
                  const subtotalValue = entries.reduce((sum, entry) => sum + entry.assetValue, 0);
                  
                  return (
                    <div key={department} className="group-section">
                      {/* Department Header */}
                      <div className="group-header">
                        <strong>{department} ({entries.length} deployments)</strong>
                      </div>
                      
                      {/* Entries */}
                      {entries.map((entry, index) => (
                        <div key={`${department}-${index}`} className="entry-row">
                          <span className="col-transmittal">{entry.transmittalNumber}</span>
                          <span className="col-asset-code">{entry.assetCode}</span>
                          <span className="col-description">{entry.assetDescription}</span>
                          <span className="col-serial">{entry.serialNumber}</span>
                          <span className="col-employee">{entry.employeeName}</span>
                          <span className="col-emp-id">{entry.employeeId}</span>
                          <span className="col-deployed">{entry.deployedDate}</span>
                          <span className="col-expected">{entry.expectedReturnDate}</span>
                          <span className="col-returned">{entry.returnedDate}</span>
                          <span className="col-status">{entry.status}</span>
                          <span className="col-value">₱{formatCurrency(entry.assetValue)}</span>
                        </div>
                      ))}
                      
                      {/* Subtotal */}
                      <div className="subtotal-row">
                        <span className="subtotal-label">TOTAL {department}</span>
                        <div className="subtotal-amounts">
                          {entries.length} deployments - ₱{formatCurrency(subtotalValue)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Grand Total */}
                <div className="grand-total">
                  <div className="total-line"></div>
                  <div className="total-row">
                    <span className="total-label">TOTAL ASSET DEPLOYMENTS</span>
                    <div className="total-amounts">
                      {totalDeployments} deployments - ₱{formatCurrency(totalAssetValue)}
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

        .filter-summary {
          font-size: 11px;
          margin: 8px 0 0 0;
          color: hsl(var(--muted-foreground));
          font-style: italic;
        }

        .summary-stats {
          display: flex;
          justify-content: space-around;
          margin: 20px 0;
          padding: 15px;
          background: hsl(var(--muted));
          border-radius: 8px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-size: 18px;
          font-weight: bold;
          color: hsl(var(--foreground));
        }

        .stat-label {
          font-size: 11px;
          color: hsl(var(--muted-foreground));
          margin-top: 4px;
        }

        .column-headers {
          margin-top: 25px;
        }

        .header-row {
          display: grid;
          grid-template-columns: 80px 80px 1fr 80px 100px 80px 80px 80px 80px 80px 100px;
          gap: 6px;
          padding: 8px 0;
          font-weight: bold;
          font-size: 10px;
          color: hsl(var(--foreground));
          background: hsl(var(--muted));
          border-radius: 4px;
          padding: 8px;
        }

        .col-deployed, .col-expected, .col-returned, .col-status, .col-value {
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
          background: hsl(var(--muted));
          padding: 8px;
          border-radius: 4px;
        }

        .entry-row {
          display: grid;
          grid-template-columns: 80px 80px 1fr 80px 100px 80px 80px 80px 80px 80px 100px;
          gap: 6px;
          padding: 4px 0;
          font-size: 9px;
          color: hsl(var(--foreground));
          border-bottom: 1px solid hsl(var(--border));
        }

        .col-deployed, .col-expected, .col-returned, .col-status, .col-value {
          text-align: right;
          font-family: 'Courier New', monospace;
        }

        .subtotal-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          font-weight: bold;
          font-size: 11px;
          color: hsl(var(--foreground));
          margin-top: 8px;
          background: hsl(var(--muted));
          border-radius: 4px;
        }

        .subtotal-amounts {
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

          .summary-stats, .group-header, .header-row, .subtotal-row {
            background: #f5f5f5 !important;
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
            grid-template-columns: 70px 70px 1fr 70px 90px 70px 70px 70px 70px 70px 90px;
            gap: 4px;
          }
        }

        @media screen and (max-width: 768px) {
          .print-page {
            transform: scale(0.5);
          }

          .header-row, .entry-row {
            grid-template-columns: 60px 60px 1fr 60px 80px 60px 60px 60px 60px 60px 80px;
            gap: 3px;
            font-size: 8px;
          }
        }
      `}</style>
    </div>
  );
}