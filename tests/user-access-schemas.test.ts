import assert from "node:assert/strict"
import test from "node:test"

import {
  createEmployeeSystemUserInputSchema,
  deleteStandaloneSystemUserInputSchema,
  updateEmployeePortalCapabilityOverridesInputSchema,
  updateLinkedUserCredentialsInputSchema,
  updateStandaloneSystemUserInputSchema,
} from "../modules/employees/user-access/schemas/user-access-actions-schema.ts"

const COMPANY_ID = "9b1deb4d-bcf9-4f57-9d80-b6fb3be12f3f"
const USER_ID = "2f3e4e58-7f58-4a6c-a1a9-2dd9e7ec6a4f"
const EMPLOYEE_ID = "3d1deb4d-bcf9-4f57-9d80-b6fb3be12f4a"

test("createEmployeeSystemUserInputSchema accepts username-only linked account setup payload", () => {
  const parsed = createEmployeeSystemUserInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    username: "jane.doe",
    password: "Password123",
    companyRole: "EMPLOYEE",
    isRequestApprover: false,
    isMaterialRequestPurchaser: false,
    isMaterialRequestPoster: false,
  })

  assert.equal(parsed.success, true)
})

test("updateLinkedUserCredentialsInputSchema accepts linked account updates without email", () => {
  const parsed = updateLinkedUserCredentialsInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    username: "jane.doe",
    isActive: true,
  })

  assert.equal(parsed.success, true)
})

test("updateStandaloneSystemUserInputSchema accepts a valid standalone system account payload", () => {
  const parsed = updateStandaloneSystemUserInputSchema.safeParse({
    companyId: COMPANY_ID,
    userId: USER_ID,
    firstName: "Jane",
    lastName: "Doe",
    username: "jane.doe",
    email: "jane.doe@example.com",
    isActive: true,
    companyRole: "HR_ADMIN",
    isRequestApprover: true,
    isMaterialRequestPurchaser: false,
    isMaterialRequestPoster: true,
  })

  assert.equal(parsed.success, true)
})

test("updateStandaloneSystemUserInputSchema rejects invalid email", () => {
  const parsed = updateStandaloneSystemUserInputSchema.safeParse({
    companyId: COMPANY_ID,
    userId: USER_ID,
    firstName: "Jane",
    lastName: "Doe",
    username: "jane.doe",
    email: "not-an-email",
    isActive: true,
    companyRole: "EMPLOYEE",
    isRequestApprover: false,
    isMaterialRequestPurchaser: false,
    isMaterialRequestPoster: false,
  })

  assert.equal(parsed.success, false)
})

test("deleteStandaloneSystemUserInputSchema requires valid ids", () => {
  const valid = deleteStandaloneSystemUserInputSchema.safeParse({
    companyId: COMPANY_ID,
    userId: USER_ID,
  })
  assert.equal(valid.success, true)

  const invalid = deleteStandaloneSystemUserInputSchema.safeParse({
    companyId: "bad-id",
    userId: USER_ID,
  })
  assert.equal(invalid.success, false)
})

test("updateEmployeePortalCapabilityOverridesInputSchema accepts unique capability overrides", () => {
  const parsed = updateEmployeePortalCapabilityOverridesInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    overrides: [
      { capability: "payslips.view", accessScope: "NONE" },
      { capability: "purchase_orders.manage", accessScope: "COMPANY" },
    ],
  })

  assert.equal(parsed.success, true)
})

test("updateEmployeePortalCapabilityOverridesInputSchema rejects duplicate capabilities", () => {
  const parsed = updateEmployeePortalCapabilityOverridesInputSchema.safeParse({
    companyId: COMPANY_ID,
    employeeId: EMPLOYEE_ID,
    overrides: [
      { capability: "payslips.view", accessScope: "NONE" },
      { capability: "payslips.view", accessScope: "OWN" },
    ],
  })

  assert.equal(parsed.success, false)
})
