import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/profile/profile-view";

interface ProfilePageProps {
  params: Promise<{
    businessUnitId: string;
  }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const { businessUnitId } = await params;

  // Fetch complete user data including createdAt and profilePicture
  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      role: true,
      classification: true,
      profilePicture: true,
      createdAt: true,
      updatedAt: true,
      businessUnit: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!userData) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="space-y-6">
      <ProfileView 
        user={userData}
        businessUnitId={businessUnitId}
      />
    </div>
  );
}