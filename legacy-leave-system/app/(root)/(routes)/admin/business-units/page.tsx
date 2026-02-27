import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BusinessUnitManagement } from "@/components/admin/business-unit-management";
import { getBusinessUnits, getUnassignedUsers } from "@/lib/actions/business-unit-actions";

export default async function AdminBusinessUnitsPage() {
  const session = await auth();
  
  // Check if user is authenticated and is admin
  if (!session?.user) {
    redirect("/");
  }
  
  if (session.user.role !== "ADMIN") {
    redirect("/setup");
  }

  // Show the business unit management interface
  const [businessUnits, unassignedUsers] = await Promise.all([
    getBusinessUnits(),
    getUnassignedUsers()
  ]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Business Unit Management
          </h1>
          <p className="text-muted-foreground">
            Create business units and assign users to them.
          </p>
        </div>
        
        <BusinessUnitManagement 
          businessUnits={businessUnits}
          unassignedUsers={unassignedUsers}
          businessUnitId="admin"
        />
      </div>
    </div>
  );
}