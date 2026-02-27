import { auth } from "@/auth";
import { validateSession, refreshSession } from "@/lib/actions/session-management-actions";

/**
 * Validate if the current user's session is still active in the database
 * Call this in your middleware or at the start of protected pages
 */
export async function validateUserSession() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { valid: false, reason: "No session" };
  }

  // Check if session exists and is not expired in database
  const isValid = await validateSession(session.user.id);
  
  if (!isValid) {
    return { valid: false, reason: "Session expired" };
  }

  // Refresh session expiration on activity
  await refreshSession(session.user.id);

  return { valid: true };
}
