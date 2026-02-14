import assert from "node:assert/strict"
import test from "node:test"

import {
  COMPANY_ROLES,
  hasAttendanceSensitiveAccess,
  hasModuleAccess,
} from "../modules/auth/utils/authorization-policy.ts"

test("hasAttendanceSensitiveAccess allows only COMPANY_ADMIN and HR_ADMIN", () => {
  const allowed = COMPANY_ROLES.filter((role) => hasAttendanceSensitiveAccess(role))
  const denied = COMPANY_ROLES.filter((role) => !hasAttendanceSensitiveAccess(role))

  assert.deepEqual(allowed, ["COMPANY_ADMIN", "HR_ADMIN"])
  assert.deepEqual(denied, ["PAYROLL_ADMIN", "APPROVER", "EMPLOYEE"])
})

test("attendance module access does not grant attendance-sensitive access", () => {
  assert.equal(hasModuleAccess("EMPLOYEE", "attendance"), true)
  assert.equal(hasAttendanceSensitiveAccess("EMPLOYEE"), false)
})
