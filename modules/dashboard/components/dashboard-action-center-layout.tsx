"use client"

import {
  DashboardLayout,
} from "@/modules/dashboard/components/dashboard-layout"
import type { DashboardActionCenterData } from "@/modules/dashboard/utils/get-dashboard-action-center-data"

export type DashboardActionCenterLayoutProps = {
  companyId: string
  companyName: string
  companyCode: string
  companyRole: string
  data: DashboardActionCenterData
}

export function DashboardActionCenterLayout(props: DashboardActionCenterLayoutProps) {
  return <DashboardLayout {...props} />
}
