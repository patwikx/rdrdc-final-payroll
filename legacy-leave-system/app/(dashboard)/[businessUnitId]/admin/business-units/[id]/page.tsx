import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BusinessUnitDetailsView } from "@/components/admin/business-units/business-unit-details-view";

interface BusinessUnitDetailsPageProps {
  params: Promise<{
    businessUnitId: string;
    id: string;
  }>;
}

export default async function BusinessUnitDetailsPage({ params }: BusinessUnitDetailsPageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  // Only admins can access business units management
  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const { businessUnitId, id } = await params;

  // Fetch business unit with related data
  const businessUnit = await prisma.businessUnit.findUnique({
    where: { id },
    include: {
      employees: {
        select: {
          id: true,
          name: true,
          employeeId: true,
          email: true,
          role: true,
          classification: true,
          createdAt: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });

  if (!businessUnit) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BusinessUnitDetailsView 
        businessUnit={businessUnit}
        currentUser={session.user}
        businessUnitId={businessUnitId}
      />
    </div>
  );
}