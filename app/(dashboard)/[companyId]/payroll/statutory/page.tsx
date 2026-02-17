import { redirect } from "next/navigation"

type PayrollStatutoryPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function PayrollStatutoryPage({ params }: PayrollStatutoryPageProps) {
  const { companyId } = await params
  redirect(`/${companyId}/reports/payroll`)
}
