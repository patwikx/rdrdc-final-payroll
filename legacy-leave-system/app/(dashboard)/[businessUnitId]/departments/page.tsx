import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDepartments } from "@/lib/actions/department-actions";
import { DepartmentsManagementView } from "@/components/departments/departments-management-view";

interface DepartmentsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function DepartmentsPage({ params }: DepartmentsPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  const { businessUnitId } = await params;
  
  // Check if user has department management permissions (HR or ADMIN)
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    redirect(`/${businessUnitId}/unauthorized`);
  }
  
  try {
    const departments = await getDepartments();
    
    return (
      <div className="space-y-6">
        <DepartmentsManagementView 
          departments={departments}
          businessUnitId={businessUnitId}
          isAdmin={session.user.role === "ADMIN"}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading departments:", error);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Department Management</h1>
          </div>
        </div>
        
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load departments. Please try again later.</p>
        </div>
      </div>
    );
  }
}