import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { validateSession, refreshSession } from "@/lib/actions/session-management-actions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { valid: false, reason: "No session" },
        { status: 401 }
      );
    }

    // Check if session exists and is not expired in database
    const isValid = await validateSession(session.user.id);
    
    if (!isValid) {
      return NextResponse.json(
        { valid: false, reason: "Session expired" },
        { status: 401 }
      );
    }

    // Refresh session expiration on activity
    await refreshSession(session.user.id);

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Session validation error:", error);
    return NextResponse.json(
      { valid: false, reason: "Validation error" },
      { status: 500 }
    );
  }
}
