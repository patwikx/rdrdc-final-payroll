import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAuditLogs } from "@/lib/actions/audit-log-actions";
import { AuditLogsView } from "@/components/audit-logs/audit-logs-view";

interface AuditLogsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    tableName?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}

export default async function AuditLogsPage({ params, searchParams }: AuditLogsPageProps) {
  const session = await auth();

  const { businessUnitId } = await params;

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  // Check if user has audit log viewing permissions (Admin only)
  if (session.user.role !== "ADMIN") {
    redirect(`/${businessUnitId}/unauthorized`);
  }


  const { tableName, action, userId, startDate, endDate, page = "1" } = await searchParams;
  
  try {
    const auditLogsData = await getAuditLogs({
      businessUnitId,
      tableName,
      action,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: parseInt(page),
      pageSize: 50,
    });
    
    return (
      <div className="space-y-6">
        <AuditLogsView 
          auditLogsData={auditLogsData}
          businessUnitId={businessUnitId}
          currentFilters={{
            tableName,
            action,
            userId,
            startDate,
            endDate,
            page: parseInt(page),
          }}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading audit logs:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground mt-2">System activity and security logs</p>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load audit logs. Please try again later.</p>
        </div>
      </div>
    );
  }
}
