import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DamagedInventoryReport } from "@/components/reports/damaged-inventory-report"

interface DamagedInventoryReportPageProps {
  params: Promise<{
    businessUnitId: string
  }>
}

export default async function DamagedInventoryReportPage({ params }: DamagedInventoryReportPageProps) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/sign-in")
  }

  // Check if user has accounting access
  if (!session.user.isAcctg) {
    redirect("/unauthorized")
  }
  
  const { businessUnitId } = await params
  
  return <DamagedInventoryReport businessUnitId={businessUnitId} />
}
