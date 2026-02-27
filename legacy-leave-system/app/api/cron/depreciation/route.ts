import { NextRequest, NextResponse } from "next/server"
import { handleDepreciationCron } from "@/lib/cron/depreciation-scheduler"

// This API route is called by Vercel Cron Jobs
// Configure in vercel.json:
// {
//   "crons": [
//     {
//       "path": "/api/cron/depreciation",
//       "schedule": "0 23 30,31 * *"
//     }
//   ]
// }

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron (optional security check)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("Depreciation cron job triggered at:", new Date().toISOString())
    
    const result = await handleDepreciationCron()
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: "Depreciation jobs completed successfully",
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error("Error in depreciation cron API:", error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Allow POST for manual triggering (with proper authentication)
export async function POST(request: NextRequest) {
  try {
    // Add authentication check for manual triggers
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("Manual depreciation job triggered at:", new Date().toISOString())
    
    const result = await handleDepreciationCron()
    
    return NextResponse.json({
      success: result.success,
      error: result.error,
      message: result.success ? "Manual depreciation job completed" : "Manual depreciation job failed",
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("Error in manual depreciation trigger:", error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}