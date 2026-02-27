import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LeaveRequestForm } from "@/components/forms/leave-request-form";
import { getLeaveTypes } from "@/lib/actions/request-actions";

interface CreateLeaveRequestPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function CreateLeaveRequestPage({ params }: CreateLeaveRequestPageProps) {
  const session = await auth();
  
  // Redirect if not authenticated
  if (!session?.user) {
    redirect("/");
  }

  const { businessUnitId } = await params;

  // Fetch leave types for the form
  const leaveTypes = await getLeaveTypes();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Submit Leave Request</h1>
        <p className="text-muted-foreground">
          Fill out the form below to submit your leave request for approval.
        </p>
      </div>

      {/* Form */}
      <LeaveRequestForm 
        leaveTypes={leaveTypes}
        businessUnitId={businessUnitId}
      />
    </div>
  );
}