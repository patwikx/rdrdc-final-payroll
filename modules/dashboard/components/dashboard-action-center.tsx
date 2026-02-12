"use client"

import {
  DashboardActionCenterLayout,
} from "@/modules/dashboard/components/dashboard-action-center-layout"
import type { DashboardActionCenterData } from "@/modules/dashboard/utils/get-dashboard-action-center-data"

type DashboardActionCenterProps = {
  companyId: string
  companyName: string
  companyCode: string
  companyRole: string
  data: DashboardActionCenterData
}

export function DashboardActionCenter(props: DashboardActionCenterProps) {
  return <DashboardActionCenterLayout {...props} />
}
