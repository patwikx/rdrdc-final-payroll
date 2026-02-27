/**
 * Business Unit Access Control Utilities
 * 
 * Centralized logic for checking if a user has access to a specific business unit
 */

import { Session } from "next-auth"

/**
 * Check if a user can access any business unit (cross-business unit access)
 * 
 * Users with cross-business unit access:
 * - ADMIN: Full system access
 * - HR: Can manage employees across all business units
 * - isAcctg: Accounting users need access to all business units for financial operations
 * - isPurchaser: Purchasing users need access to all business units for procurement
 */
export function hasGlobalBusinessUnitAccess(user: Session["user"]): boolean {
  return (
    user.role === "ADMIN" ||
    user.role === "HR" ||
    user.isAcctg === true ||
    user.isPurchaser === true
  )
}

/**
 * Check if a user has access to a specific business unit
 * 
 * @param user - The authenticated user from session
 * @param businessUnitId - The business unit ID to check access for
 * @returns true if user has access, false otherwise
 */
export function canAccessBusinessUnit(
  user: Session["user"],
  businessUnitId: string
): boolean {
  // Global access users can access any business unit
  if (hasGlobalBusinessUnitAccess(user)) {
    return true
  }

  // Regular users can only access their assigned business unit
  return user.businessUnit?.id === businessUnitId
}

/**
 * Throw an error if user doesn't have access to the business unit
 * 
 * @param user - The authenticated user from session
 * @param businessUnitId - The business unit ID to check access for
 * @throws Error if user doesn't have access
 */
export function requireBusinessUnitAccess(
  user: Session["user"],
  businessUnitId: string
): void {
  if (!canAccessBusinessUnit(user, businessUnitId)) {
    throw new Error(
      `Access denied: User business unit ${user.businessUnit?.id} does not match requested ${businessUnitId}`
    )
  }
}
