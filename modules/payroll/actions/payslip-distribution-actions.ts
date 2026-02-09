"use server"

import { EmailAuditEventType, EmailDeliveryStatus, type CompanyRole } from "@prisma/client"
import { Resend } from "resend"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import { hasModuleAccess } from "@/modules/auth/utils/authorization-policy"
import { payrollRunActionInputSchema } from "@/modules/payroll/schemas/payroll-run-actions-schema"
import { generatePayslipPdfBuffer } from "@/modules/employee-portal/utils/payslip-pdf"

type SendPayslipBatchResult =
  | {
      ok: true
      message: string
      sentCount: number
      failedCount: number
      skippedCount: number
      failures: Array<{ payslipId: string; employeeName: string; email: string; reason: string; retryCount: number }>
    }
  | { ok: false; error: string }

type PreviewPayslipEmailResult =
  | {
      ok: true
      data: {
        recipientEmail: string
        employeeName: string
        subject: string
        html: string
        plainText: string
      }
    }
  | { ok: false; error: string }

const toCompanyRole = (value: string): CompanyRole => value as CompanyRole

const EMAIL_BATCH_WINDOW_MS = 10 * 60 * 1000
const EMAIL_BATCH_MAX_PER_WINDOW = 100
const EMAIL_RETRY_COOLDOWN_MS = 60 * 1000
const EMAIL_BATCH_DUPLICATE_GUARD_MS = 90 * 1000

const monthShort = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  timeZone: "Asia/Manila",
})

const dayLabel = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  timeZone: "Asia/Manila",
})

const yearLabel = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  timeZone: "Asia/Manila",
})

const toPeriodRangeLabel = (start: Date, end: Date): string => {
  return `${monthShort.format(start)} ${dayLabel.format(start)} to ${monthShort.format(end)} ${dayLabel.format(end)}, ${yearLabel.format(end)}`
}

const toHalfLabel = (periodHalf: string): string => {
  if (periodHalf === "FIRST") return "1st Half"
  if (periodHalf === "SECOND") return "2nd Half"
  return "Payroll"
}

const buildPayslipEmailTemplate = (input: {
  employeeName: string
  companyName: string
  periodHalf: string
  periodRange: string
}) => {
  const periodLabel = toHalfLabel(input.periodHalf)
  const sanitizeSubject = (value: string): string => value.replace(/[\r\n]+/g, " ").trim()
  const escapeHtml = (value: string): string =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")

  const safeCompanyName = escapeHtml(input.companyName)
  const safeEmployeeName = escapeHtml(input.employeeName)
  const safePeriodLabel = escapeHtml(periodLabel)
  const safePeriodRange = escapeHtml(input.periodRange)

  const subject = sanitizeSubject(`Payslip • ${periodLabel} • ${input.periodRange}`)
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6;max-width:620px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:10px;">
      <h2 style="margin:0 0 10px;font-size:20px;">${safeCompanyName} Payslip</h2>
      <p style="margin:0 0 12px;">Hello ${safeEmployeeName},</p>
      <p style="margin:0 0 12px;">Your payslip for the <strong>${safePeriodLabel}</strong> payroll period (<strong>${safePeriodRange}</strong>) is attached to this email.</p>
      <p style="margin:0 0 12px;">Please keep this document for your records.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0;" />
      <p style="margin:0;font-size:12px;color:#6b7280;">This is an automated payroll message. Please do not reply to this email.</p>
    </div>
  `

  return { subject, html }
}

const htmlToPlainText = (value: string): string => {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const ensurePayrollAccess = async (companyId: string): Promise<{ ok: true; context: Awaited<ReturnType<typeof getActiveCompanyContext>> } | { ok: false; error: string }> => {
  const context = await getActiveCompanyContext({ companyId })
  if (!hasModuleAccess(toCompanyRole(context.companyRole), "payroll")) {
    return { ok: false, error: "Unauthorized payroll access." }
  }

  return { ok: true, context }
}

const toFailedMessageId = (payslipId: string): string => `FAILED-${payslipId}-${Date.now()}`

const assertBatchSendRateLimit = async (userId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
  const windowStart = new Date(Date.now() - EMAIL_BATCH_WINDOW_MS)
  const recentSendCount = await db.emailDeliveryRecord.count({
    where: {
      sentBy: userId,
      sentAt: { gte: windowStart },
    },
  })

  if (recentSendCount >= EMAIL_BATCH_MAX_PER_WINDOW) {
    return {
      ok: false,
      error: "Email rate limit reached. Please wait a few minutes before sending more payslips.",
    }
  }

  return { ok: true }
}

const assertRetryCooldown = async (payslipId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
  const recentRecord = await db.emailDeliveryRecord.findFirst({
    where: { payslipId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  })

  if (!recentRecord?.sentAt) return { ok: true }

  if (Date.now() - recentRecord.sentAt.getTime() < EMAIL_RETRY_COOLDOWN_MS) {
    return { ok: false, error: "Please wait at least 1 minute before retrying this payslip email." }
  }

  return { ok: true }
}

export async function previewPayrollPayslipEmailAction(input: {
  companyId: string
  payslipId: string
}): Promise<PreviewPayslipEmailResult> {
  const access = await ensurePayrollAccess(input.companyId)
  if (!access.ok) return access
  const { context } = access

  const payslip = await db.payslip.findFirst({
    where: {
      id: input.payslipId,
      payrollRun: { companyId: context.companyId },
    },
    select: {
      id: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          emails: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: { email: true },
          },
          user: {
            select: { email: true },
          },
        },
      },
      payrollRun: {
        select: {
          company: {
            select: {
              name: true,
            },
          },
          payPeriod: {
            select: {
              periodHalf: true,
              cutoffStartDate: true,
              cutoffEndDate: true,
            },
          },
        },
      },
    },
  })

  if (!payslip) {
    return { ok: false, error: "Payslip not found." }
  }

  const recipientEmail = payslip.employee.emails[0]?.email ?? payslip.employee.user?.email ?? null
  if (!recipientEmail) {
    return { ok: false, error: "No active employee email." }
  }

  const employeeName = `${payslip.employee.lastName}, ${payslip.employee.firstName}`
  const periodRange = toPeriodRangeLabel(
    payslip.payrollRun.payPeriod.cutoffStartDate,
    payslip.payrollRun.payPeriod.cutoffEndDate
  )
  const template = buildPayslipEmailTemplate({
    employeeName,
    companyName: payslip.payrollRun.company.name,
    periodHalf: payslip.payrollRun.payPeriod.periodHalf,
    periodRange,
  })

  return {
    ok: true,
    data: {
      recipientEmail,
      employeeName,
      subject: template.subject,
      html: template.html,
      plainText: htmlToPlainText(template.html),
    },
  }
}

export async function sendPayrollRunPayslipEmailsAction(input: { companyId: string; runId: string }): Promise<SendPayslipBatchResult> {
  const parsed = payrollRunActionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload." }
  }

  const access = await ensurePayrollAccess(parsed.data.companyId)
  if (!access.ok) return access
  const { context } = access

  const rateLimitResult = await assertBatchSendRateLimit(context.userId)
  if (!rateLimitResult.ok) return rateLimitResult

  const resendApiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.PAYSLIP_EMAIL_FROM

  if (!resendApiKey || !fromAddress) {
    return { ok: false, error: "Payslip email is not configured. Set RESEND_API_KEY and PAYSLIP_EMAIL_FROM." }
  }

  const run = await db.payrollRun.findFirst({
    where: {
      id: parsed.data.runId,
      companyId: context.companyId,
    },
    include: {
      company: {
        select: {
          name: true,
          legalName: true,
          logoUrl: true,
          payslipWatermarkText: true,
        },
      },
      payPeriod: {
        select: {
          periodNumber: true,
          periodHalf: true,
          cutoffStartDate: true,
          cutoffEndDate: true,
        },
      },
      payslips: {
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
              emails: {
                where: { isActive: true },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
                select: { email: true },
              },
              user: {
                select: { email: true },
              },
            },
          },
          earnings: {
            select: {
              amount: true,
              earningType: { select: { name: true } },
            },
          },
          deductions: {
            select: {
              amount: true,
              deductionType: { select: { name: true } },
            },
          },
        },
        orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
      },
    },
  })

  if (!run) {
    return { ok: false, error: "Payroll run not found." }
  }

  if (run.payslips.length === 0) {
    return { ok: false, error: "No payslips found for this run." }
  }

  const duplicateGuardStart = new Date(Date.now() - EMAIL_BATCH_DUPLICATE_GUARD_MS)
  const recentBatchDispatch = await db.auditLog.count({
    where: {
      tableName: "PayrollRun",
      recordId: run.id,
      userId: context.userId,
      reason: "SEND_PAYSLIPS_EMAIL_BATCH",
      createdAt: { gte: duplicateGuardStart },
    },
  })

  if (recentBatchDispatch > 0) {
    return { ok: false, error: "Batch send already triggered recently. Please wait before sending again." }
  }

  const resend = new Resend(resendApiKey)

  let sentCount = 0
  let failedCount = 0
  let skippedCount = 0
  const failures: Array<{ payslipId: string; employeeName: string; email: string; reason: string; retryCount: number }> = []

  for (const payslip of run.payslips) {
    const employeeName = `${payslip.employee.lastName}, ${payslip.employee.firstName}`
    const recipientEmail = payslip.employee.emails[0]?.email ?? payslip.employee.user?.email ?? null

    if (!recipientEmail) {
      skippedCount += 1
      failures.push({ payslipId: payslip.id, employeeName, email: "", reason: "No active employee email.", retryCount: 0 })
      continue
    }

    const periodRange = toPeriodRangeLabel(run.payPeriod.cutoffStartDate, run.payPeriod.cutoffEndDate)
    const template = buildPayslipEmailTemplate({
      employeeName,
      companyName: run.company.name,
      periodHalf: run.payPeriod.periodHalf,
      periodRange,
    })
    const subject = template.subject
    const html = template.html

    try {
      const pdfPayload = {
        payslipNumber: payslip.payslipNumber,
        generatedAt: payslip.generatedAt,
        releasedAt: payslip.releasedAt,
        periodNumber: run.payPeriod.periodNumber,
        cutoffStartDate: run.payPeriod.cutoffStartDate,
        cutoffEndDate: run.payPeriod.cutoffEndDate,
        employeeName,
        employeeNumber: payslip.employee.employeeNumber,
        companyName: run.company.name,
        companyLegalName: run.company.legalName,
        companyLogoUrl: run.company.logoUrl,
        watermarkText: run.company.payslipWatermarkText ?? process.env.PAYSLIP_PDF_WATERMARK ?? null,
        baseSalary: Number(payslip.baseSalary),
        basicPay: Number(payslip.basicPay),
        grossPay: Number(payslip.grossPay),
        totalDeductions: Number(payslip.totalDeductions),
        netPay: Number(payslip.netPay),
        sssEmployee: Number(payslip.sssEmployee),
        philHealthEmployee: Number(payslip.philHealthEmployee),
        pagIbigEmployee: Number(payslip.pagIbigEmployee),
        withholdingTax: Number(payslip.withholdingTax),
        daysWorked: Number(payslip.daysWorked),
        daysAbsent: Number(payslip.daysAbsent),
        overtimeHours: Number(payslip.overtimeHours),
        tardinessMins: payslip.tardinessMins,
        earnings: payslip.earnings.map((item) => ({
          name: item.earningType.name,
          amount: Number(item.amount),
        })),
        deductions: payslip.deductions.map((item) => ({
          name: item.deductionType.name,
          amount: Number(item.amount),
        })),
      }

      const pdfBuffer = await generatePayslipPdfBuffer(pdfPayload)

      const result = await resend.emails.send({
        from: fromAddress,
        to: recipientEmail,
        subject,
        html,
        attachments: [
          {
            filename: `${payslip.payslipNumber}.pdf`,
            content: pdfBuffer.toString("base64"),
          },
        ],
      })

      if (result.error) {
        failedCount += 1
        failures.push({
          payslipId: payslip.id,
          employeeName,
          email: recipientEmail,
          reason: result.error.message,
          retryCount: 0,
        })

        await db.emailDeliveryRecord.create({
          data: {
            payslipId: payslip.id,
            recipientEmail,
            recipientName: employeeName,
            subject,
            sentBy: context.userId,
            sentAt: new Date(),
            deliveryStatus: EmailDeliveryStatus.FAILED,
            resendMessageId: toFailedMessageId(payslip.id),
            errorMessage: result.error.message,
          },
        })

        await db.emailAuditLog.create({
          data: {
            eventType: EmailAuditEventType.EMAIL_FAILED,
            userId: context.userId,
            payslipId: payslip.id,
            recipientEmail,
            timestamp: new Date(),
            metadata: {
              runId: run.id,
              runNumber: run.runNumber,
              error: result.error.message,
            },
          },
        })

        continue
      }

      sentCount += 1

      await db.emailDeliveryRecord.create({
        data: {
          payslipId: payslip.id,
          recipientEmail,
          recipientName: employeeName,
          subject,
          sentBy: context.userId,
          sentAt: new Date(),
          deliveryStatus: EmailDeliveryStatus.SENT,
          resendMessageId: result.data?.id ?? toFailedMessageId(payslip.id),
        },
      })

      await db.emailAuditLog.create({
        data: {
          eventType: EmailAuditEventType.EMAIL_SENT,
          userId: context.userId,
          payslipId: payslip.id,
          recipientEmail,
          timestamp: new Date(),
          metadata: {
            runId: run.id,
            runNumber: run.runNumber,
            resendMessageId: result.data?.id ?? null,
          },
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      failedCount += 1
      failures.push({
        payslipId: payslip.id,
        employeeName,
        email: recipientEmail,
        reason: message,
        retryCount: 0,
      })

      await db.emailDeliveryRecord.create({
        data: {
          payslipId: payslip.id,
          recipientEmail,
          recipientName: employeeName,
          subject,
          sentBy: context.userId,
          sentAt: new Date(),
          deliveryStatus: EmailDeliveryStatus.FAILED,
          resendMessageId: toFailedMessageId(payslip.id),
          errorMessage: message,
        },
      })

      await db.emailAuditLog.create({
        data: {
          eventType: EmailAuditEventType.EMAIL_FAILED,
          userId: context.userId,
          payslipId: payslip.id,
          recipientEmail,
          timestamp: new Date(),
          metadata: {
            runId: run.id,
            runNumber: run.runNumber,
            error: message,
          },
        },
      })
    }
  }

  await createAuditLog({
    tableName: "PayrollRun",
    recordId: run.id,
    action: "UPDATE",
    userId: context.userId,
    reason: "SEND_PAYSLIPS_EMAIL_BATCH",
    changes: [
      { fieldName: "emailSentCount", newValue: sentCount },
      { fieldName: "emailFailedCount", newValue: failedCount },
      { fieldName: "emailSkippedCount", newValue: skippedCount },
    ],
  })

  const message = `Email batch complete: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped.`

  return {
    ok: true,
    message,
    sentCount,
    failedCount,
    skippedCount,
    failures,
  }
}

export async function resendPayrollPayslipEmailAction(input: {
  companyId: string
  payslipId: string
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const access = await ensurePayrollAccess(input.companyId)
  if (!access.ok) return access
  const { context } = access

  const rateLimitResult = await assertBatchSendRateLimit(context.userId)
  if (!rateLimitResult.ok) return rateLimitResult

  const retryCooldownResult = await assertRetryCooldown(input.payslipId)
  if (!retryCooldownResult.ok) return retryCooldownResult

  const resendApiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.PAYSLIP_EMAIL_FROM

  if (!resendApiKey || !fromAddress) {
    return { ok: false, error: "Payslip email is not configured. Set RESEND_API_KEY and PAYSLIP_EMAIL_FROM." }
  }

  const payslip = await db.payslip.findFirst({
    where: {
      id: input.payslipId,
      payrollRun: { companyId: context.companyId },
    },
    include: {
      payrollRun: {
        include: {
          company: {
            select: {
              name: true,
              legalName: true,
              logoUrl: true,
              payslipWatermarkText: true,
            },
          },
          payPeriod: {
            select: {
              periodNumber: true,
              periodHalf: true,
              cutoffStartDate: true,
              cutoffEndDate: true,
            },
          },
        },
      },
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          emails: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: { email: true },
          },
          user: {
            select: { email: true },
          },
        },
      },
      earnings: {
        select: {
          amount: true,
          earningType: { select: { name: true } },
        },
      },
      deductions: {
        select: {
          amount: true,
          deductionType: { select: { name: true } },
        },
      },
    },
  })

  if (!payslip) {
    return { ok: false, error: "Payslip not found." }
  }

  const recipientEmail = payslip.employee.emails[0]?.email ?? payslip.employee.user?.email ?? null
  if (!recipientEmail) {
    return { ok: false, error: "No active employee email." }
  }

  const employeeName = `${payslip.employee.lastName}, ${payslip.employee.firstName}`
  const periodRange = toPeriodRangeLabel(
    payslip.payrollRun.payPeriod.cutoffStartDate,
    payslip.payrollRun.payPeriod.cutoffEndDate
  )
  const template = buildPayslipEmailTemplate({
    employeeName,
    companyName: payslip.payrollRun.company.name,
    periodHalf: payslip.payrollRun.payPeriod.periodHalf,
    periodRange,
  })
  const subject = template.subject
  const html = template.html
  const resend = new Resend(resendApiKey)

  try {
    const pdfPayload = {
      payslipNumber: payslip.payslipNumber,
      generatedAt: payslip.generatedAt,
      releasedAt: payslip.releasedAt,
      periodNumber: payslip.payrollRun.payPeriod.periodNumber,
      cutoffStartDate: payslip.payrollRun.payPeriod.cutoffStartDate,
      cutoffEndDate: payslip.payrollRun.payPeriod.cutoffEndDate,
      employeeName,
      employeeNumber: payslip.employee.employeeNumber,
      companyName: payslip.payrollRun.company.name,
      companyLegalName: payslip.payrollRun.company.legalName,
      companyLogoUrl: payslip.payrollRun.company.logoUrl,
      watermarkText: payslip.payrollRun.company.payslipWatermarkText ?? process.env.PAYSLIP_PDF_WATERMARK ?? null,
      baseSalary: Number(payslip.baseSalary),
      basicPay: Number(payslip.basicPay),
      grossPay: Number(payslip.grossPay),
      totalDeductions: Number(payslip.totalDeductions),
      netPay: Number(payslip.netPay),
      sssEmployee: Number(payslip.sssEmployee),
      philHealthEmployee: Number(payslip.philHealthEmployee),
      pagIbigEmployee: Number(payslip.pagIbigEmployee),
      withholdingTax: Number(payslip.withholdingTax),
      daysWorked: Number(payslip.daysWorked),
      daysAbsent: Number(payslip.daysAbsent),
      overtimeHours: Number(payslip.overtimeHours),
      tardinessMins: payslip.tardinessMins,
      earnings: payslip.earnings.map((item) => ({
        name: item.earningType.name,
        amount: Number(item.amount),
      })),
      deductions: payslip.deductions.map((item) => ({
        name: item.deductionType.name,
        amount: Number(item.amount),
      })),
    }

    const pdfBuffer = await generatePayslipPdfBuffer(pdfPayload)

    const result = await resend.emails.send({
      from: fromAddress,
      to: recipientEmail,
      subject,
      html,
      attachments: [
        {
          filename: `${payslip.payslipNumber}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    })

    if (result.error) {
      return { ok: false, error: result.error.message }
    }

    await db.emailDeliveryRecord.create({
      data: {
        payslipId: payslip.id,
        recipientEmail,
        recipientName: employeeName,
        subject,
        sentBy: context.userId,
        sentAt: new Date(),
        deliveryStatus: EmailDeliveryStatus.SENT,
        resendMessageId: result.data?.id ?? toFailedMessageId(payslip.id),
      },
    })

    await db.emailAuditLog.create({
      data: {
        eventType: EmailAuditEventType.EMAIL_SENT,
        userId: context.userId,
        payslipId: payslip.id,
        recipientEmail,
        timestamp: new Date(),
        metadata: {
          runId: payslip.payrollRun.id,
          runNumber: payslip.payrollRun.runNumber,
          resendMessageId: result.data?.id ?? null,
          isRetry: true,
        },
      },
    })

    return { ok: true, message: "Payslip email sent successfully." }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: message }
  }
}
