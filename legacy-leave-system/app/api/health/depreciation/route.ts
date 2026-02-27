import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Health check endpoint for depreciation scheduler
export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    // Get active schedules count
    const activeSchedules = await prisma.depreciationSchedule.count({
      where: { isActive: true }
    })
    
    // Get recent executions (last 7 days)
    const recentExecutions = await prisma.depreciationExecution.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    })
    
    // Get assets ready for depreciation
    const assetsReady = await prisma.asset.count({
      where: {
        isActive: true,
        depreciationMethod: { not: null },
        isFullyDepreciated: false
      }
    })
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      scheduler: {
        activeSchedules,
        recentExecutions,
        assetsReady
      },
      endpoints: {
        cron: '/api/cron/depreciation-schedules',
        manual: '/api/admin/trigger-depreciation',
        health: '/api/health/depreciation'
      }
    })
    
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}