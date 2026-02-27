import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BusinessUnitsView } from "@/components/admin/business-units/business-units-view";

interface BusinessUnitsPageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function BusinessUnitsPage({ params }: BusinessUnitsPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  // Only admins can access business units management
  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const { businessUnitId } = await params;

  // Fetch all business units
  const businessUnits = await prisma.businessUnit.findMany({
    include: {
      _count: {
        select: {
          employees: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <BusinessUnitsView 
        businessUnits={businessUnits}
        currentUser={session.user}
        businessUnitId={businessUnitId}
      />
    </div>
  );
}