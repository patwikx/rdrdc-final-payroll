import { redirect } from "next/navigation"

type ReportsPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { companyId } = await params
  redirect(`/${companyId}/reports/payroll`)
}

