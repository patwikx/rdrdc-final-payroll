import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DepreciationCalculationView } from "@/components/asset-management/depreciation-calculation-view";
import { getAssetsForDepreciation } from "@/lib/actions/depreciation-calculation-actions";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Depreciation Calculation",
  description: "Calculate monthly depreciation for assets due for depreciation",
};

interface DepreciationCalculationPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
  searchParams: Promise<{
    override?: string;
  }>;
}

export default async function DepreciationCalculationPage({ 
  params, 
  searchParams 
}: DepreciationCalculationPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const { businessUnitId } = await params;
  const { override } = await searchParams;

  // Check if user has permission (ADMIN or ACCTG only)
  if (session.user.role !== "ADMIN" && session.user.role !== "ACCTG") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to calculate depreciation.
          </p>
          <p className="text-sm text-muted-foreground">
            Only ADMIN and ACCTG roles can access this section.
          </p>
        </div>
      </div>
    );
  }

  try {
    const depreciationData = await getAssetsForDepreciation(businessUnitId, override === 'true');

    return (
      <div className="space-y-6">
        <DepreciationCalculationView 
          data={depreciationData}
          businessUnitId={businessUnitId}
          canOverride={session.user.role === "ADMIN"}
        />
      </div>
    );
  } catch (error) {
    console.error("Depreciation calculation page error:", error);
    
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Page</h2>
          <p className="text-muted-foreground mb-4">
            There was an error loading the depreciation calculation page.
          </p>
          <p className="text-sm text-muted-foreground">
            Please try refreshing the page or contact support if the issue persists.
          </p>
        </div>
      </div>
    );
  }
}