import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OvertimeRequestForm } from "@/components/forms/overtime-request-form";

interface CreateOvertimeRequestPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function CreateOvertimeRequestPage({ params }: CreateOvertimeRequestPageProps) {
  const session = await auth();
  
  // Redirect if not authenticated
  if (!session?.user) {
    redirect("/");
  }

  const { businessUnitId } = await params;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Submit Overtime Request</h1>
        <p className="text-muted-foreground">
          Fill out the form below to submit your overtime request for approval.
        </p>
      </div>

      {/* Form */}
      <OvertimeRequestForm businessUnitId={businessUnitId} />
    </div>
  );
}