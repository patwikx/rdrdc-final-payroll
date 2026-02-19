import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"

export type PayrollPayslipsViewModel = {
  companyId: string
  companyName: string
  defaultStartDate: string
  defaultEndDate: string
  pageSize: number
}

const toDateInput = (value: Date): string => {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, "0")
  const day = String(value.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function getPayrollPayslipsViewModel(companyId: string): Promise<PayrollPayslipsViewModel> {
  const context = await getActiveCompanyContext({ companyId })

  const end = new Date()
  const start = new Date(end)
  start.setUTCMonth(start.getUTCMonth() - 6)

  return {
    companyId: context.companyId,
    companyName: context.companyName,
    defaultStartDate: toDateInput(start),
    defaultEndDate: toDateInput(end),
    pageSize: 10,
  }
}
