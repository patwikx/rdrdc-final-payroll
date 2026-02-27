/**
 * Depreciation Scheduler - Automated End-of-Month Depreciation Calculation
 * 
 * This module handles the automated execution of depreciation calculations
 * at the end of each month (30th or 31st day).
 * 
 * Setup Instructions:
 * 1. For Vercel: Use Vercel Cron Jobs (vercel.json)
 * 2. For other platforms: Use node-cron or similar
 * 3. For manual setup: Call runScheduledDepreciationJobs() from your scheduler
 */

import { runEndOfMonthDepreciation } from "@/lib/actions/depreciation-schedule-actions-simple"

// For Vercel Cron Jobs - create API route at /api/cron/depreciation
export async function handleDepreciationCron() {
  try {
    console.log("Starting scheduled depreciation cron job...")
    const result = await runEndOfMonthDepreciation()
    console.log("Completed scheduled depreciation cron job:", result)
    return { success: true, result }
  } catch (error) {
    console.error("Error in depreciation cron job:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// For node-cron setup (if using custom server)
export function setupDepreciationCron() {
  // Uncomment if using node-cron
  /*
  const cron = require('node-cron')
  
  // Run every day at 11:59 PM to check if it's end of month
  cron.schedule('59 23 * * *', async () => {
    const today = new Date()
    const isEndOfMonth = isLastDayOfMonth(today) || today.getDate() >= 30
    
    if (isEndOfMonth) {
      console.log("End of month detected, running depreciation jobs...")
      await runScheduledDepreciationJobs()
    }
  }, {
    timezone: "Asia/Manila" // Adjust to your timezone
  })
  
  console.log("Depreciation cron job scheduled")
  */
}

function isLastDayOfMonth(date: Date): boolean {
  const nextDay = new Date(date)
  nextDay.setDate(date.getDate() + 1)
  return nextDay.getMonth() !== date.getMonth()
}

// Manual execution function for testing
export async function testDepreciationScheduler() {
  console.log("Testing depreciation scheduler...")
  const result = await handleDepreciationCron()
  console.log("Test result:", result)
  return result
}