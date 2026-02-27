import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

// Manual trigger for testing depreciation schedules
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    // Only allow admins to manually trigger
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the cron endpoint internally
    const cronUrl = new URL('/api/cron/depreciation-schedules', request.url)
    const cronResponse = await fetch(cronUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'test'}`
      }
    })

    const result = await cronResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Depreciation schedules triggered manually',
      result,
      triggeredBy: session.user.name,
      triggeredAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Manual trigger failed:', error)
    return NextResponse.json(
      { 
        error: 'Failed to trigger depreciation schedules', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}