"use client"

import {
  DashboardIteration1,
  type DashboardIterationProps,
} from "@/modules/dashboard/components/dashboard-iterations"
import type { DashboardActionCenterData } from "@/modules/dashboard/utils/get-dashboard-action-center-data"

type DashboardActionCenterProps = {
  companyId: string
  companyName: string
  companyCode: string
  companyRole: string
  data: DashboardActionCenterData
}

export function DashboardActionCenter(props: DashboardActionCenterProps) {
  return <DashboardIteration1 {...props} iterationNumber={1} />
}
