import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/actions/session-management-actions";

/**
 * Cron job to clean up expired sessions
 * 
 * Setup in Vercel:
 * 1. Go to your project settings
 * 2. Add Cron Job
 * 3. Schedule: 0 * * * * (every hour)
 * 4. URL: /api/cron/cleanup-sessions
 * 
 * Or call manually for testing:
 * GET /api/cron/cleanup-sessions?secret=your_secret_key
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    
    // If CRON_SECRET is set, require it for authentication
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Clean up expired sessions
    const result = await cleanupExpiredSessions();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Cleaned up ${result.deletedCount} expired sessions`,
        deletedCount: result.deletedCount,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Cleanup failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Session cleanup cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
