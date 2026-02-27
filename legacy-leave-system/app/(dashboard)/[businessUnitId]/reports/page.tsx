import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Clock, 
  Users, 
  Calendar,
  TrendingUp,
  BarChart3
} from "lucide-react";
import Link from "next/link";

interface ReportsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  // Await the params Promise
  const { businessUnitId } = await params;
  
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/sign-in");
  }
  
  // Only admins and HR can access reports
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    redirect(`/${businessUnitId}`);
  }

  const reportCards = [
    {
      title: "Leave Reports",
      description: "View approved leave requests, analytics, and trends",
      icon: Calendar,
      href: `/${businessUnitId}/reports/leave`,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20"
    },
    {
      title: "Overtime Reports",
      description: "Track approved overtime hours and employee overtime patterns",
      icon: Clock,
      href: `/${businessUnitId}/reports/overtime`,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20"
    },
    {
      title: "Employee Leave Balances",
      description: "Export and analyze employee leave balances across all leave types",
      icon: Users,
      href: `/${businessUnitId}/reports/employees`,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/20"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reports Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Access comprehensive reports and analytics for leave management
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Reports</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Comprehensive reporting modules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Export</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">CSV</div>
            <p className="text-xs text-muted-foreground">
              Export data for external analysis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Real-time Data</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Live</div>
            <p className="text-xs text-muted-foreground">
              Up-to-date information and analytics
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.title} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${report.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${report.color}`} />
                </div>
                <CardTitle className="text-lg">{report.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {report.description}
                </p>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={report.href}>
                    View Report
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Report Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Leave Reports</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• View all approved leave requests</li>
                <li>• Filter by date range, department, employee, or leave type</li>
                <li>• Export detailed CSV reports</li>
                <li>• Track leave usage patterns and trends</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Overtime Reports</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Monitor approved overtime hours</li>
                <li>• Analyze overtime patterns by employee and department</li>
                <li>• Export overtime data for payroll processing</li>
                <li>• Track overtime trends over time</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Employee Leave Balances</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• View current leave balances for all employees</li>
                <li>• Focus on SICK, VACATION, CTO, and MANDATORY leave</li>
                <li>• Export balance data for HR planning</li>
                <li>• Identify employees with excess leave balances</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Data Export & Analytics</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• CSV export for all report types</li>
                <li>• Real-time data with advanced filtering</li>
                <li>• Statistical summaries and insights</li>
                <li>• Admin and HR access controls</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}