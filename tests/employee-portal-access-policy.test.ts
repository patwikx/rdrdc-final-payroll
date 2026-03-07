import assert from "node:assert/strict"
import test from "node:test"

import {
  getEmployeePortalCapabilityScope,
  hasEmployeePortalCapability,
  resolveEmployeePortalCapabilityScopes,
  resolveEmployeePortalCapabilities,
} from "../modules/employee-portal/utils/employee-portal-access-policy.ts"

test("employee portal access policy grants purchasers procurement capabilities when workflow is enabled", () => {
  const capabilities = resolveEmployeePortalCapabilities({
    companyRole: "EMPLOYEE",
    purchaseRequestWorkflowEnabled: true,
    isRequestApprover: false,
    isMaterialRequestPurchaser: true,
    isMaterialRequestPoster: false,
    isPurchaseRequestItemManager: false,
    hasEmployeeProfile: true,
  })

  assert.equal(hasEmployeePortalCapability(capabilities, "purchase_requests.view"), true)
  assert.equal(hasEmployeePortalCapability(capabilities, "purchase_requests.create"), true)
  assert.equal(hasEmployeePortalCapability(capabilities, "purchase_requests.view_all"), true)
  assert.equal(hasEmployeePortalCapability(capabilities, "purchase_orders.manage"), true)
  assert.equal(hasEmployeePortalCapability(capabilities, "goods_receipt_pos.manage"), true)
  assert.equal(hasEmployeePortalCapability(capabilities, "purchase_requests.manage_all"), false)
})

test("employee portal access policy keeps self-service routes employee-only", () => {
  const adminCapabilities = resolveEmployeePortalCapabilities({
    companyRole: "COMPANY_ADMIN",
    purchaseRequestWorkflowEnabled: true,
    isRequestApprover: false,
    isMaterialRequestPurchaser: false,
    isMaterialRequestPoster: false,
    isPurchaseRequestItemManager: false,
    hasEmployeeProfile: false,
  })

  assert.equal(hasEmployeePortalCapability(adminCapabilities, "payslips.view"), false)
  assert.equal(hasEmployeePortalCapability(adminCapabilities, "leave_requests.manage"), false)
  assert.equal(hasEmployeePortalCapability(adminCapabilities, "overtime_requests.manage"), false)
  assert.equal(hasEmployeePortalCapability(adminCapabilities, "purchase_requests.manage_all"), true)
})

test("employee portal capability scopes distinguish own, queue, and company-wide access", () => {
  const scopes = resolveEmployeePortalCapabilityScopes({
    companyRole: "EMPLOYEE",
    purchaseRequestWorkflowEnabled: true,
    isRequestApprover: true,
    isMaterialRequestPurchaser: true,
    isMaterialRequestPoster: false,
    isPurchaseRequestItemManager: false,
    hasEmployeeProfile: true,
  })

  assert.equal(getEmployeePortalCapabilityScope(scopes, "leave_requests.manage"), "OWN")
  assert.equal(getEmployeePortalCapabilityScope(scopes, "leave_approvals.view"), "APPROVAL_QUEUE")
  assert.equal(getEmployeePortalCapabilityScope(scopes, "purchase_orders.manage"), "COMPANY")
  assert.equal(getEmployeePortalCapabilityScope(scopes, "purchase_requests.view"), "OWN")
  assert.equal(getEmployeePortalCapabilityScope(scopes, "purchase_requests.view_all"), "COMPANY")
})

test("employee portal overrides can deny inherited access without bypassing disabled workflow gates", () => {
  const deniedScopes = resolveEmployeePortalCapabilityScopes(
    {
      companyRole: "EMPLOYEE",
      purchaseRequestWorkflowEnabled: true,
      isRequestApprover: false,
      isMaterialRequestPurchaser: true,
      isMaterialRequestPoster: false,
      isPurchaseRequestItemManager: false,
      hasEmployeeProfile: true,
    },
    [{ capability: "purchase_orders.manage", accessScope: "NONE" }]
  )

  assert.equal(getEmployeePortalCapabilityScope(deniedScopes, "purchase_orders.manage"), "NONE")

  const gatedScopes = resolveEmployeePortalCapabilityScopes(
    {
      companyRole: "COMPANY_ADMIN",
      purchaseRequestWorkflowEnabled: false,
      isRequestApprover: false,
      isMaterialRequestPurchaser: false,
      isMaterialRequestPoster: false,
      isPurchaseRequestItemManager: false,
      hasEmployeeProfile: false,
    },
    [{ capability: "purchase_orders.manage", accessScope: "COMPANY" }]
  )

  assert.equal(getEmployeePortalCapabilityScope(gatedScopes, "purchase_orders.manage"), "NONE")
})

test("employee portal overrides can grant non-gated pages beyond role defaults", () => {
  const scopes = resolveEmployeePortalCapabilityScopes(
    {
      companyRole: "COMPANY_ADMIN",
      purchaseRequestWorkflowEnabled: true,
      isRequestApprover: false,
      isMaterialRequestPurchaser: false,
      isMaterialRequestPoster: false,
      isPurchaseRequestItemManager: false,
      hasEmployeeProfile: false,
    },
    [{ capability: "payslips.view", accessScope: "OWN" }]
  )

  assert.equal(getEmployeePortalCapabilityScope(scopes, "payslips.view"), "OWN")
})
