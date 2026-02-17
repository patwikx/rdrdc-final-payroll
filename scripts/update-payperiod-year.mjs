import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const toSet = (value) => {
  if (!value) return new Set()
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  )
}

const getArgValue = (args, name) => {
  const index = args.findIndex((item) => item === name)
  if (index < 0) return undefined
  return args[index + 1]
}

const hasFlag = (args, name) => args.includes(name)

const printUsage = () => {
  console.log("Update PayPeriod records by ID or pattern (safe dry-run by default).")
  console.log("")
  console.log("Usage:")
  console.log(
    "  node scripts/update-payperiod-year.mjs [--ids <id1,id2,...>] [--pattern-id <patternId>] [--to-year <year>] [--sync-cutoff-years] [--sync-payment-year] [--sync-audit-years] [--reopen] [--apply]"
  )
  console.log("")
  console.log("Examples:")
  console.log(
    "  node scripts/update-payperiod-year.mjs --ids e1335d39-7a6f-486a-9cbe-b66145a7d994 --to-year 2025"
  )
  console.log(
    "  node scripts/update-payperiod-year.mjs --pattern-id e1335d39-7a6f-486a-9cbe-b66145a7d994 --to-year 2025 --sync-cutoff-years --sync-payment-year --sync-audit-years --apply"
  )
  console.log(
    "  node scripts/update-payperiod-year.mjs --ids e1335d39-7a6f-486a-9cbe-b66145a7d994 --to-year 2025 --reopen --apply"
  )
  console.log("  node scripts/update-payperiod-year.mjs --ids id1,id2,id3 --reopen --apply")
  console.log("")
  console.log("Notes:")
  console.log("- Dry-run mode is default. No updates are written unless --apply is passed.")
  console.log("- Year update is skipped per row when unique conflict exists on (patternId, year, periodNumber).")
  console.log("- --reopen sets statusCode=OPEN and clears lockedAt/lockedById.")
  console.log("- --sync-cutoff-years updates cutoffStartDate/cutoffEndDate year to --to-year while keeping month/day unchanged.")
  console.log("- --sync-payment-year updates paymentDate year to --to-year while keeping month/day unchanged.")
  console.log("- --sync-audit-years updates createdAt/updatedAt year to --to-year while keeping month/day/time unchanged.")
}

const toInt = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.trunc(parsed)
}

const withYearKeepingUtc = (dateValue, targetYear, options = { keepTime: false }) => {
  const month = dateValue.getUTCMonth()
  const day = dateValue.getUTCDate()
  const hours = options.keepTime ? dateValue.getUTCHours() : 0
  const minutes = options.keepTime ? dateValue.getUTCMinutes() : 0
  const seconds = options.keepTime ? dateValue.getUTCSeconds() : 0
  const milliseconds = options.keepTime ? dateValue.getUTCMilliseconds() : 0

  const next = new Date(Date.UTC(targetYear, month, day, hours, minutes, seconds, milliseconds))
  if (next.getUTCMonth() !== month || next.getUTCDate() !== day) {
    return null
  }
  return next
}

const toDateOnlyLabel = (dateValue) => dateValue.toISOString().slice(0, 10)
const toDateTimeLabel = (dateValue) => dateValue.toISOString()

const main = async () => {
  const args = process.argv.slice(2)
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printUsage()
    return
  }

  const idValue = getArgValue(args, "--ids")
  const patternIdValue = getArgValue(args, "--pattern-id")
  const toYearValue = getArgValue(args, "--to-year")
  const syncCutoffYears = hasFlag(args, "--sync-cutoff-years")
  const syncPaymentYear = hasFlag(args, "--sync-payment-year")
  const syncAuditYears = hasFlag(args, "--sync-audit-years")
  const reopen = hasFlag(args, "--reopen")
  const apply = hasFlag(args, "--apply")

  const ids = Array.from(toSet(idValue))
  const patternIds = Array.from(toSet(patternIdValue))
  const toYear = toInt(toYearValue)

  if (ids.length === 0 && patternIds.length === 0) {
    printUsage()
    process.exit(1)
  }

  if (toYear === null && !reopen) {
    printUsage()
    process.exit(1)
  }

  if ((syncCutoffYears || syncPaymentYear || syncAuditYears) && toYear === null) {
    printUsage()
    process.exit(1)
  }

  const payPeriods = await prisma.payPeriod.findMany({
    where: {
      OR: [
        ids.length > 0 ? { id: { in: ids } } : undefined,
        patternIds.length > 0 ? { patternId: { in: patternIds } } : undefined,
      ].filter(Boolean),
    },
    select: {
      id: true,
      patternId: true,
      year: true,
      periodNumber: true,
      periodHalf: true,
      statusCode: true,
      lockedAt: true,
      lockedById: true,
      cutoffStartDate: true,
      cutoffEndDate: true,
      paymentDate: true,
      createdAt: true,
      updatedAt: true,
      payrollRuns: {
        select: {
          id: true,
          runNumber: true,
        },
      },
    },
    orderBy: [
      { patternId: "asc" },
      { year: "asc" },
      { periodNumber: "asc" },
    ],
  })

  const foundIds = new Set(payPeriods.map((item) => item.id))
  const missingIds = ids.filter((id) => !foundIds.has(id))

  if (missingIds.length > 0) {
    console.log("Missing pay period IDs:")
    missingIds.forEach((id) => console.log(`- ${id}`))
  }

  if (patternIds.length > 0) {
    const foundPatternIds = new Set(payPeriods.map((item) => item.patternId))
    const missingPatternIds = patternIds.filter((id) => !foundPatternIds.has(id))
    if (missingPatternIds.length > 0) {
      console.log("Missing pattern IDs (no pay periods found):")
      missingPatternIds.forEach((id) => console.log(`- ${id}`))
    }
  }

  if (payPeriods.length === 0) {
    console.log("No valid pay periods found to process.")
    process.exit(1)
  }

  const plans = []

  for (const row of payPeriods) {
    const updates = {}
    const notes = []
    let hasYearConflict = false

    if (toYear !== null) {
      if (row.year === toYear) {
        notes.push(`year already ${toYear}`)
      } else {
        const conflict = await prisma.payPeriod.findFirst({
          where: {
            patternId: row.patternId,
            year: toYear,
            periodNumber: row.periodNumber,
            id: { not: row.id },
          },
          select: {
            id: true,
            periodHalf: true,
          },
        })

        if (conflict) {
          hasYearConflict = true
          notes.push(
            `year conflict: ${conflict.id} already has ${toYear} period ${row.periodNumber} ${conflict.periodHalf}`
          )
        } else {
          updates.year = toYear
          notes.push(`year ${row.year} -> ${toYear}`)
        }
      }
    }

    if (syncCutoffYears && toYear !== null) {
      const canSyncCutoffYears = !hasYearConflict || row.year === toYear
      if (!canSyncCutoffYears) {
        notes.push("cutoff year sync skipped due year conflict")
      } else {
        const nextStart = withYearKeepingUtc(row.cutoffStartDate, toYear)
        const nextEnd = withYearKeepingUtc(row.cutoffEndDate, toYear)

        const startChanged = row.cutoffStartDate.getUTCFullYear() !== toYear
        const endChanged = row.cutoffEndDate.getUTCFullYear() !== toYear

        if (startChanged && nextStart) {
          updates.cutoffStartDate = nextStart
        }
        if (endChanged && nextEnd) {
          updates.cutoffEndDate = nextEnd
        }

        if ((startChanged && !nextStart) || (endChanged && !nextEnd)) {
          notes.push("cutoff year sync skipped for invalid calendar date in target year")
        } else if (startChanged || endChanged) {
          notes.push(
            `cutoff dates ${toDateOnlyLabel(row.cutoffStartDate)}-${toDateOnlyLabel(row.cutoffEndDate)} -> ${toDateOnlyLabel(nextStart)}-${toDateOnlyLabel(nextEnd)}`
          )
          if (nextStart > nextEnd) {
            notes.push("warning: cutoffStartDate is later than cutoffEndDate after year sync")
          }
        } else {
          notes.push(`cutoff years already ${toYear}`)
        }
      }
    }

    if (syncPaymentYear && toYear !== null) {
      const canSyncPaymentYear = !hasYearConflict || row.year === toYear
      if (!canSyncPaymentYear) {
        notes.push("payment year sync skipped due year conflict")
      } else {
        const nextPaymentDate = withYearKeepingUtc(row.paymentDate, toYear)
        const paymentChanged = row.paymentDate.getUTCFullYear() !== toYear

        if (paymentChanged && nextPaymentDate) {
          updates.paymentDate = nextPaymentDate
          notes.push(`paymentDate ${toDateOnlyLabel(row.paymentDate)} -> ${toDateOnlyLabel(nextPaymentDate)}`)
        } else if (paymentChanged && !nextPaymentDate) {
          notes.push("payment year sync skipped for invalid calendar date in target year")
        } else {
          notes.push(`payment year already ${toYear}`)
        }
      }
    }

    if (syncAuditYears && toYear !== null) {
      const canSyncAuditYears = !hasYearConflict || row.year === toYear
      if (!canSyncAuditYears) {
        notes.push("audit year sync skipped due year conflict")
      } else {
        const nextCreatedAt = withYearKeepingUtc(row.createdAt, toYear, { keepTime: true })
        const nextUpdatedAt = withYearKeepingUtc(row.updatedAt, toYear, { keepTime: true })
        const createdChanged = row.createdAt.getUTCFullYear() !== toYear
        const updatedChanged = row.updatedAt.getUTCFullYear() !== toYear

        if (createdChanged && nextCreatedAt) {
          updates.createdAt = nextCreatedAt
        }
        if (updatedChanged && nextUpdatedAt) {
          updates.updatedAt = nextUpdatedAt
        }

        if ((createdChanged && !nextCreatedAt) || (updatedChanged && !nextUpdatedAt)) {
          notes.push("audit year sync skipped for invalid calendar date in target year")
        } else if (createdChanged || updatedChanged) {
          notes.push(
            `audit dates createdAt ${toDateTimeLabel(row.createdAt)} -> ${toDateTimeLabel(nextCreatedAt)} | updatedAt ${toDateTimeLabel(row.updatedAt)} -> ${toDateTimeLabel(nextUpdatedAt)}`
          )
        } else {
          notes.push(`audit years already ${toYear}`)
        }
      }
    }

    if (reopen) {
      const needsReopen = row.statusCode !== "OPEN" || row.lockedAt !== null || row.lockedById !== null
      if (needsReopen) {
        updates.statusCode = "OPEN"
        updates.lockedAt = null
        updates.lockedById = null
        notes.push(`status ${row.statusCode} -> OPEN`)
      } else {
        notes.push("already OPEN")
      }
    }

    const hasUpdates = Object.keys(updates).length > 0
    const status = hasUpdates ? (hasYearConflict ? "READY_PARTIAL" : "READY") : hasYearConflict ? "SKIP_CONFLICT" : "SKIP_NO_CHANGE"

    plans.push({
      id: row.id,
      status,
      reason: notes.join(" | "),
      fromYear: row.year,
      toYear,
      periodNumber: row.periodNumber,
      periodHalf: row.periodHalf,
      statusCode: row.statusCode,
      runCount: row.payrollRuns.length,
      updates,
    })
  }

  console.log("")
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`)
  console.log(`Target year: ${toYear ?? "(unchanged)"}`)
  console.log(`Sync cutoff years: ${syncCutoffYears ? "yes" : "no"}`)
  console.log(`Sync payment year: ${syncPaymentYear ? "yes" : "no"}`)
  console.log(`Sync audit years: ${syncAuditYears ? "yes" : "no"}`)
  console.log(`Reopen locked periods: ${reopen ? "yes" : "no"}`)
  console.log("")
  console.log("Plan:")

  for (const plan of plans) {
    const runInfo = `runs=${plan.runCount}`
    console.log(
      `- ${plan.status} ${plan.id} | year=${plan.fromYear}${plan.toYear === null ? "" : ` -> ${plan.toYear}`} | period=${plan.periodNumber}(${plan.periodHalf}) | status=${plan.statusCode} | ${runInfo} | ${plan.reason}`
    )
  }

  const updatable = plans.filter((plan) => plan.status === "READY" || plan.status === "READY_PARTIAL")
  if (!apply) {
    console.log("")
    console.log(`Dry-run complete. Updatable rows: ${updatable.length}`)
    console.log("Add --apply to execute updates.")
    return
  }

  if (updatable.length === 0) {
    console.log("")
    console.log("No rows eligible for update.")
    return
  }

  await prisma.$transaction(
    updatable.map((plan) =>
      prisma.payPeriod.update({
        where: { id: plan.id },
        data: plan.updates,
      })
    )
  )

  console.log("")
  console.log(`Updated pay periods: ${updatable.length}`)
  updatable.forEach((plan) => {
    console.log(`- ${plan.id}: ${JSON.stringify(plan.updates)}`)
  })
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
