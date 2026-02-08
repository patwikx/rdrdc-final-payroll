import { redirect } from "next/navigation"

type AttendanceExceptionsRouteProps = {
  params: Promise<{ companyId: string }>
}

export default async function AttendanceExceptionsRoutePage({ params }: AttendanceExceptionsRouteProps) {
  const { companyId } = await params
  redirect(`/${companyId}/attendance/sync-biometrics`)
}
