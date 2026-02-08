import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type LoanCalculatorPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function LoanCalculatorPage({ params }: LoanCalculatorPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Employee Self-Service</p>
        <h1 className="text-2xl text-foreground">Loan Calculator</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Use the dashboard loan calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>The full loan calculator is available in the loans module under your company dashboard.</p>
          <Button asChild variant="outline">
            <Link href={`/${context.companyId}/dashboard/loans`}>Go to Loans</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
