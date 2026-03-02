import { EmployeePortalChangeLogPage } from "@/modules/employee-portal/components/employee-portal-change-log-page"

type EmployeePortalChangeLogRouteProps = {
  params: Promise<{ companyId: string }>
}

export default async function EmployeePortalChangeLogRoutePage({ params }: EmployeePortalChangeLogRouteProps) {
  const { companyId } = await params

  return (
    <div className="-m-4 sm:-m-6">
      <EmployeePortalChangeLogPage companyId={companyId} />
    </div>
  )
}
