import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserById, getAllManagers, getAllBusinessUnits, getAllDepartments } from "@/lib/actions/user-management-actions";
import { getAllRoles } from "@/lib/actions/role-actions";
import { EditUserForm } from "@/components/users/edit-user-form";

interface EditUserPageProps {
  params: Promise<{
    businessUnitId: string;
    id: string;
  }>;
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  
  // Check if user has user management permissions
  if (session.user.role !== "ADMIN" && session.user.role !== "HR") {
    redirect("/unauthorized");
  }

  const { businessUnitId, id } = await params;
  
  try {
    // Fetch user data and related data in parallel
    const [user, managers, businessUnits, departments, roles] = await Promise.all([
      getUserById(id),
      getAllManagers(),
      getAllBusinessUnits(),
      getAllDepartments(),
      getAllRoles()
    ]);
    
    if (!user) {
      redirect(`/${businessUnitId}/admin/users`);
    }
    
    // Check if HR user is trying to edit user from different business unit
    if (session.user.role === "HR" && user.businessUnit?.id !== businessUnitId) {
      redirect("/unauthorized");
    }
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit User</h1>
            <p className="text-muted-foreground">
              Update user information and permissions
            </p>
          </div>
        </div>
        
        <EditUserForm 
          user={user}
          businessUnitId={businessUnitId}
          managers={managers}
          businessUnits={businessUnits}
          departments={departments}
          roles={roles}
          isAdmin={session.user.role === "ADMIN"}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading user:", error);
    redirect(`/${businessUnitId}/admin/users`);
  }
}