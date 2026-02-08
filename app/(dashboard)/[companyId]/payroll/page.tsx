import { redirect } from "next/navigation"

type PayrollPageProps = {
  params: Promise<{ companyId: string }>
}

export default async function PayrollPage({ params }: PayrollPageProps) {
  const { companyId } = await params
  redirect(`/${companyId}/payroll/runs`)
}
