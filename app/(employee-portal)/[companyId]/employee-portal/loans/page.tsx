import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getEmployeePortalContext } from "@/modules/employee-portal/utils/get-employee-portal-context"

type LoansPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function LoansPage({ params }: LoansPageProps) {
  const { companyId } = await params
  const context = await getEmployeePortalContext(companyId)

  if (!context) {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Employee Self-Service</p>
        <h1 className="text-2xl text-foreground">Loan Applications</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan module is on the main dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Your employee loan workflow currently runs under the dashboard module. Use the shortcut below to continue.</p>
          <Button asChild variant="outline">
            <Link href={`/${context.companyId}/dashboard/loans`}>Open Loan Module</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
