import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { executeDepreciationSchedule } from "@/lib/services/depreciation-scheduler"

// This API route should be called by a cron service (like Vercel Cron, GitHub Actions, or external cron)
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a trusted source (optional but recommended)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🕐 Checking for scheduled depreciation executions...')

    const today = new Date()
    const currentDay = today.getDate()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    // Find active schedules that should run today
    const schedulesToRun = await prisma.depreciationSchedule.findMany({
      where: {
        isActive: true,
        OR: [
          // Monthly schedules that should run today
          {
            scheduleType: 'MONTHLY',
            executionDay: currentDay
          },
          // Quarterly schedules (run on last month of quarter: Mar, Jun, Sep, Dec)
          ...(currentMonth % 3 === 0 ? [{
            scheduleType: 'QUARTERLY' as const,
            executionDay: currentDay
          }] : []),
          // Annual schedules (run in December)
          ...(currentMonth === 12 ? [{
            scheduleType: 'ANNUALLY' as const,
            executionDay: currentDay
          }] : [])
        ]
      },
      include: {
        businessUnit: true,
        creator: true
      }
    })

    console.log(`📋 Found ${schedulesToRun.length} schedules to execute`)

    const results = []

    for (const schedule of schedulesToRun) {
      try {
        // Check if we already ran this schedule today
        const existingExecution = await prisma.depreciationExecution.findFirst({
          where: {
            scheduleId: schedule.id,
            executionDate: {
              gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
              lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
            }
          }
        })

        if (existingExecution) {
          console.log(`⏭️  Schedule ${schedule.name} already executed today, skipping`)
          continue
        }

        console.log(`🚀 Executing schedule: ${schedule.name}`)
        
        const result = await executeDepreciationSchedule(schedule as any)
        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: 'success',
          executionId: result.executionId,
          assetsProcessed: result.assetsProcessed
        })

        console.log(`✅ Schedule ${schedule.name} completed successfully`)
      } catch (error) {
        console.error(`❌ Error executing schedule ${schedule.name}:`, error)
        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${schedulesToRun.length} schedules`,
      results,
      executedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Cron job failed:', error)
    return NextResponse.json(
      { 
        error: 'Cron job failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}

// Allow GET for testing purposes
export async function GET() {
  return NextResponse.json({ 
    message: 'Depreciation schedule cron endpoint is active',
    timestamp: new Date().toISOString()
  })
}