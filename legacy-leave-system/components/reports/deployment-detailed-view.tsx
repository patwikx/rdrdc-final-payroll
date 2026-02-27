"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Download, 
  Filter,
  Search,
  Eye,
  Printer,
  FileText,
  Calendar
} from "lucide-react";
import { DeploymentReportData, DeploymentReportFilters } from "@/lib/actions/deployment-reports-actions";
import { DeploymentStatus } from "@prisma/client";
import { format } from "date-fns";

interface DeploymentDetailedViewProps {
  reportData: DeploymentReportData[];
  filterOptions: {
    employees: Array<{
      id: string;
      name: string;
      employeeId: string;
    }>;
    departments: Array<{
      id: string;
      name: string;
    }>;
    categories: Array<{
      id: string;
      name: string;
      code: string;
    }>;
  };
  businessUnitId: string;
  currentFilters: DeploymentReportFilters;
}

const STATUS_LABELS: Record<string, string> = {
  [DeploymentStatus.PENDING_ACCOUNTING_APPROVAL]: "Pending Approval",
  [DeploymentStatus.DEPLOYED]: "Deployed",
  [DeploymentStatus.RETURNED]: "Returned",
  APPROVED: "Approved",
};

const STATUS_COLORS: Record<string, string> = {
  [DeploymentStatus.PENDING_ACCOUNTING_APPROVAL]: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  [DeploymentStatus.DEPLOYED]: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  [DeploymentStatus.RETURNED]: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function DeploymentDetailedView({
  reportData,
  filterOptions,
  businessUnitId,
  currentFilters
}: DeploymentDetailedViewProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof DeploymentReportData>("deployedDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Filter and search data
  const filteredData = reportData.filter(deployment => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      deployment.transmittalNumber.toLowerCase().includes(searchLower) ||
      deployment.asset.itemCode.toLowerCase().includes(searchLower) ||
      deployment.asset.description.toLowerCase().includes(searchLower) ||
      deployment.employee.name.toLowerCase().includes(searchLower) ||
      deployment.employee.employeeId.toLowerCase().includes(searchLower) ||
      (deployment.employee.department?.name || '').toLowerCase().includes(searchLower)
    );
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case "deployedDate":
        aValue = a.deployedDate ? new Date(a.deployedDate).getTime() : 0;
        bValue = b.deployedDate ? new Date(b.deployedDate).getTime() : 0;
        break;
      case "transmittalNumber":
        aValue = a.transmittalNumber;
        bValue = b.transmittalNumber;
        break;
      case "asset":
        aValue = a.asset.itemCode;
        bValue = b.asset.itemCode;
        break;
      case "employee":
        aValue = a.employee.name;
        bValue = b.employee.name;
        break;
      default:
        aValue = a[sortField];
        bValue = b[sortField];
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: keyof DeploymentReportData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const viewPrintableReport = () => {
    const params = new URLSearchParams();
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== 'all' && value !== 'ALL') {
        if (value instanceof Date) {
          params.set(key, value.toISOString().split('T')[0]);
        } else {
          params.set(key, value.toString());
        }
      }
    });
    router.push(`/${businessUnitId}/reports/deployments/preview?${params.toString()}`);
  };

  const exportData = () => {
    // Prepare CSV data
    const csvHeaders = [
      'Transmittal Number',
      'Asset Code',
      'Asset Description',
      'Serial Number',
      'Employee Name',
      'Employee ID',
      'Department',
      'Deployed Date',
      'Expected Return',
      'Returned Date',
      'Status',
      'Asset Value',
      'Deployment Condition',
      'Return Condition'
    ];

    const csvData = sortedData.map(deployment => [
      deployment.transmittalNumber,
      deployment.asset.itemCode,
      deployment.asset.description,
      deployment.asset.serialNumber || 'N/A',
      deployment.employee.name,
      deployment.employee.employeeId,
      deployment.employee.department?.name || 'No Department',
      deployment.deployedDate ? format(new Date(deployment.deployedDate), 'yyyy-MM-dd') : 'Not deployed',
      deployment.expectedReturnDate ? format(new Date(deployment.expectedReturnDate), 'yyyy-MM-dd') : 'N/A',
      deployment.returnedDate ? format(new Date(deployment.returnedDate), 'yyyy-MM-dd') : 'Not returned',
      STATUS_LABELS[deployment.status] || deployment.status,
      deployment.asset.currentBookValue || deployment.asset.purchasePrice || 0,
      deployment.deploymentCondition || 'N/A',
      deployment.returnCondition || 'N/A'
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `deployment-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Detailed Deployment Report</h2>
          <p className="text-muted-foreground">
            Complete list of all deployment records with search and filtering
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={viewPrintableReport}>
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Search & Filter</h3>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Search deployments</Label>
            <Input
              id="search"
              placeholder="Search by transmittal, asset, employee, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Label>Sort by</Label>
            <Select value={sortField} onValueChange={(value) => setSortField(value as keyof DeploymentReportData)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deployedDate">Deployed Date</SelectItem>
                <SelectItem value="transmittalNumber">Transmittal Number</SelectItem>
                <SelectItem value="asset">Asset Code</SelectItem>
                <SelectItem value="employee">Employee Name</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label>Direction</Label>
            <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as "asc" | "desc")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {paginatedData.length} of {filteredData.length} deployments
            {searchTerm && ` (filtered from ${reportData.length} total)`}
          </span>
          <span>
            Total Value: ₱{formatCurrency(
              filteredData.reduce((sum, d) => sum + (d.asset.currentBookValue || d.asset.purchasePrice || 0), 0)
            )}
          </span>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("transmittalNumber")}
              >
                Transmittal # {sortField === "transmittalNumber" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("asset")}
              >
                Asset {sortField === "asset" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("employee")}
              >
                Employee {sortField === "employee" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Department</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("deployedDate")}
              >
                Deployed {sortField === "deployedDate" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Expected Return</TableHead>
              <TableHead>Returned</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                Status {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead className="text-right">Asset Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((deployment) => (
              <TableRow key={deployment.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs">{deployment.transmittalNumber}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{deployment.asset.itemCode}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {deployment.asset.description}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {deployment.asset.serialNumber || 'N/A'}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{deployment.employee.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {deployment.employee.employeeId}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{deployment.employee.department?.name || 'No Department'}</TableCell>
                <TableCell>
                  {deployment.deployedDate 
                    ? format(new Date(deployment.deployedDate), 'MMM dd, yyyy')
                    : 'Not deployed'
                  }
                </TableCell>
                <TableCell>
                  {deployment.expectedReturnDate 
                    ? format(new Date(deployment.expectedReturnDate), 'MMM dd, yyyy')
                    : 'N/A'
                  }
                </TableCell>
                <TableCell>
                  {deployment.returnedDate 
                    ? format(new Date(deployment.returnedDate), 'MMM dd, yyyy')
                    : 'Not returned'
                  }
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[deployment.status] || "bg-gray-100 text-gray-800"}>
                    {STATUS_LABELS[deployment.status] || deployment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  ₱{formatCurrency(deployment.asset.currentBookValue || deployment.asset.purchasePrice || 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {filteredData.length === 0 && (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Deployments Found</h3>
          <p className="text-muted-foreground">
            {searchTerm 
              ? `No deployments match your search for "${searchTerm}"`
              : "No deployment data matches the selected filters."
            }
          </p>
        </div>
      )}
    </div>
  );
}