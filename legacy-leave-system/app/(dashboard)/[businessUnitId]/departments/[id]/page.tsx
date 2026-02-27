import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDepartmentById, getAvailableManagers } from "@/lib/actions/department-actions";
import { EditDepartmentForm } from "@/components/departments/edit-department-form";

interface EditDepartmentPageProps {
  params: Promise<{
    businessUnitId: string;
    id: string;
  }>;
}

export default async function EditDepartmentPage({ params }: EditDepartmentPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  const { businessUnitId, id } = await params;
  
  // Check if user has department management permissions (HR or ADMIN)
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    redirect(`/${businessUnitId}/unauthorized`);
  }
  
  try {
    // Fetch department data and available managers in parallel
    const [department, availableManagers] = await Promise.all([
      getDepartmentById(id),
      getAvailableManagers(businessUnitId)
    ]);
    
    if (!department) {
      redirect(`/${businessUnitId}/departments`);
    }
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Department Management</h1>
            <p className="text-muted-foreground">
              Update department information, manage members, and configure approvers
            </p>
          </div>
        </div>
        
        <EditDepartmentForm 
          department={department}
          availableManagers={availableManagers}
          businessUnitId={businessUnitId}
          isAdmin={session.user.role === "ADMIN"}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading department:", error);
    redirect(`/${businessUnitId}/departments`);
  }
}