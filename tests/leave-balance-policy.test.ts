import assert from "node:assert/strict"
import test from "node:test"

import { resolveLeaveBalanceChargeDecision } from "../modules/leave/utils/leave-balance-policy.ts"

const COMPANY_ID = "2e42185b-309d-43e8-8d40-e4564eab0bf6"

test("Emergency Leave charges Vacation Leave balance", () => {
  const result = resolveLeaveBalanceChargeDecision({
    sourceLeaveType: {
      id: "leave-emergency",
      code: "EL",
      name: "Emergency Leave",
      isPaid: false,
    },
    employeeCompanyId: COMPANY_ID,
    availableLeaveTypes: [
      {
        id: "leave-vacation",
        code: "VL",
        name: "Vacation Leave",
        isPaid: true,
        companyId: COMPANY_ID,
      },
    ],
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.chargeLeaveTypeId, "leave-vacation")
  assert.equal(result.chargeLeaveTypeName, "Vacation Leave")
  assert.equal(result.sourceLeaveTypeName, "Emergency Leave")
})

test("Emergency Leave errors when Vacation Leave type is not configured", () => {
  const result = resolveLeaveBalanceChargeDecision({
    sourceLeaveType: {
      id: "leave-emergency",
      code: "EL",
      name: "Emergency Leave",
      isPaid: true,
    },
    employeeCompanyId: COMPANY_ID,
    availableLeaveTypes: [],
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.match(result.error, /Vacation Leave type/i)
})

test("Paid non-emergency leave charges its own balance", () => {
  const result = resolveLeaveBalanceChargeDecision({
    sourceLeaveType: {
      id: "leave-sick",
      code: "SL",
      name: "Sick Leave",
      isPaid: true,
    },
    employeeCompanyId: COMPANY_ID,
    availableLeaveTypes: [],
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.chargeLeaveTypeId, "leave-sick")
  assert.equal(result.chargeLeaveTypeName, "Sick Leave")
})

test("Unpaid non-emergency leave does not mutate leave balance", () => {
  const result = resolveLeaveBalanceChargeDecision({
    sourceLeaveType: {
      id: "leave-lwop",
      code: "LWOP",
      name: "Leave Without Pay",
      isPaid: false,
    },
    employeeCompanyId: COMPANY_ID,
    availableLeaveTypes: [],
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.chargeLeaveTypeId, null)
  assert.equal(result.chargeLeaveTypeName, null)
})
