import { Resend } from "resend"

type RequestSubmissionEmailInput = {
  supervisorEmail: string | null
  supervisorName: string | null
  requesterName: string
  requesterEmployeeNumber: string
  requestTypeLabel: string
  requestNumber: string
  companyName: string
  /** Relative path within the app, e.g. "/abc123/employee-portal/leave-approvals" */
  approvalPath: string
  detailLines: string[]
}

type RequestSubmissionEmailResult =
  | { ok: true }
  | { ok: false; error: string }

type PurchaserRecipient = {
  userId: string
  name: string
  email: string
}

type MaterialRequestPurchaserQueueEmailInput = {
  recipients: PurchaserRecipient[]
  companyName: string
  requestNumber: string
  requesterName: string
  requesterEmployeeNumber: string
  departmentName: string
  requestTypeLabel: string
  datePreparedLabel: string
  dateRequiredLabel: string
  amountLabel: string
  /** Relative path within the app, e.g. "/abc123/employee-portal/material-request-processing" */
  approvalPath: string
}

type MaterialRequestPurchaserQueueEmailResult = {
  ok: true
  sentCount: number
  failedCount: number
  failedRecipients: Array<{ userId: string; email: string; error: string }>
}

const sanitizeSubject = (value: string): string => value.replace(/[\r\n]+/g, " ").trim()

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

/**
 * Build the full approval URL from the relative path.
 * Uses NEXT_PUBLIC_APP_URL from env, falls back to localhost:3000.
 */
const buildApprovalUrl = (approvalPath: string): string => {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "")

  const safePath = approvalPath.startsWith("/") ? approvalPath : `/${approvalPath}`
  return `${baseUrl}${safePath}`
}

/** Format the current date in PH timezone for the email timestamp */
const formatSubmissionDate = (): string =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(new Date())

/**
 * Parse a detail line in "Label: Value" format into separate parts.
 * Returns [label, value] if the pattern matches, or [null, fullLine] otherwise.
 */
const parseDetailLine = (line: string): [string | null, string] => {
  const colonIndex = line.indexOf(":")
  if (colonIndex > 0 && colonIndex < line.length - 1) {
    return [line.substring(0, colonIndex).trim(), line.substring(colonIndex + 1).trim()]
  }
  return [null, line]
}

export async function sendSupervisorRequestSubmissionEmail(
  input: RequestSubmissionEmailInput
): Promise<RequestSubmissionEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.REQUEST_APPROVAL_EMAIL_FROM ?? process.env.PAYSLIP_EMAIL_FROM

  if (!resendApiKey || !fromAddress) {
    return {
      ok: false,
      error: "Request notification email is not configured. Set RESEND_API_KEY and REQUEST_APPROVAL_EMAIL_FROM (or PAYSLIP_EMAIL_FROM).",
    }
  }

  if (!input.supervisorEmail) {
    return { ok: false, error: "Supervisor has no active email address." }
  }

  const detailLines = input.detailLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const subject = sanitizeSubject(
    `[Action Required] ${input.requestTypeLabel} #${input.requestNumber} — ${input.companyName}`
  )

  const requesterLabel =
    input.requesterEmployeeNumber.trim().length > 0
      ? `${input.requesterName} (${input.requesterEmployeeNumber})`
      : input.requesterName

  const safeSupervisorName = escapeHtml(input.supervisorName?.trim() || "Approver")
  const safeRequesterLabel = escapeHtml(requesterLabel)
  const safeRequestType = escapeHtml(input.requestTypeLabel)
  const safeRequestNumber = escapeHtml(input.requestNumber)
  const safeCompanyName = escapeHtml(input.companyName)
  const approvalUrl = buildApprovalUrl(input.approvalPath)
  const safeApprovalUrl = escapeHtml(approvalUrl)
  const submittedAt = escapeHtml(formatSubmissionDate())

  // Build detail rows — label left, value right, tight widths
  const detailRowsHtml = detailLines
    .map((line) => {
      const [label, value] = parseDetailLine(line)
      if (label) {
        return `<tr>
          <td style="padding:7px 0;font-size:13px;color:#6b7280;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:7px 0;font-size:13px;color:#1e293b;font-weight:500;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`
      }
      return `<tr>
        <td colspan="2" style="padding:7px 0;font-size:13px;color:#1e293b;">${escapeHtml(value)}</td>
      </tr>`
    })
    .join("")

  // ─── HTML Email Template ──────────────────────────────────────────────
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${sanitizeSubject(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:20px 28px;border-radius:8px 8px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:rgba(255,255,255,0.65);">${safeCompanyName}</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff;">${safeRequestType} Submitted</p>
                  </td>
                  <td align="right" valign="top">
                    <span style="display:inline-block;background-color:rgba(255,255,255,0.18);color:#ffffff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.3px;">Pending</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Card -->
          <tr>
            <td style="background-color:#ffffff;padding:24px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

              <!-- Greeting -->
              <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#334155;">Hello <strong>${safeSupervisorName}</strong>,</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">A new <strong>${safeRequestType.toLowerCase()}</strong> has been submitted and requires your review.</p>

              <!-- Request Info Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:20px;">
                <!-- Request # and Submitter -->
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="top">
                          <p style="margin:0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;">Request No.</p>
                          <p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0f172a;font-family:'Courier New',Courier,monospace;">${safeRequestNumber}</p>
                        </td>
                        <td valign="top" align="right">
                          <p style="margin:0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;">Submitted by</p>
                          <p style="margin:2px 0 0;font-size:13px;font-weight:600;color:#0f172a;">${safeRequesterLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Detail Rows -->
                <tr>
                  <td style="padding:10px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      ${detailRowsHtml}
                    </table>
                  </td>
                </tr>

                <!-- Timestamp -->
                <tr>
                  <td style="padding:8px 16px;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:11px;color:#94a3b8;">Submitted on ${submittedAt} (PHT)</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 0;">
                    <a href="${safeApprovalUrl}" target="_blank" style="display:inline-block;background-color:#2563eb;padding:11px 36px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Review Request</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:14px 28px;background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;text-align:center;">
                This is an automated notification from ${safeCompanyName} Payroll.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  // ─── Plain text fallback ──────────────────────────────────────────────
  const text = [
    `Hello ${input.supervisorName?.trim() || "Approver"},`,
    "",
    `A new ${input.requestTypeLabel.toLowerCase()} has been submitted and requires your review.`,
    "",
    `Request #: ${input.requestNumber}`,
    `Submitted by: ${requesterLabel}`,
    "",
    ...detailLines.map((line) => `  ${line}`),
    "",
    `Submitted on ${formatSubmissionDate()} (PHT)`,
    "",
    `Review: ${approvalUrl}`,
    "",
    "---",
    `${input.companyName} Payroll System`,
  ].join("\n")

  try {
    const resend = new Resend(resendApiKey)
    const result = await resend.emails.send({
      from: fromAddress,
      to: input.supervisorEmail,
      subject,
      html,
      text,
    })

    if (result.error) {
      return { ok: false, error: result.error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown email send error.",
    }
  }
}

export async function sendMaterialRequestPurchaserQueueEmail(
  input: MaterialRequestPurchaserQueueEmailInput
): Promise<MaterialRequestPurchaserQueueEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.REQUEST_APPROVAL_EMAIL_FROM ?? process.env.PAYSLIP_EMAIL_FROM

  if (!resendApiKey || !fromAddress || input.recipients.length === 0) {
    return {
      ok: true,
      sentCount: 0,
      failedCount: input.recipients.length,
      failedRecipients: input.recipients.map((recipient) => ({
        userId: recipient.userId,
        email: recipient.email,
        error: !resendApiKey || !fromAddress ? "Email configuration missing." : "No recipients.",
      })),
    }
  }

  const approvalUrl = buildApprovalUrl(input.approvalPath)
  const submittedAt = formatSubmissionDate()
  const requesterLabel =
    input.requesterEmployeeNumber.trim().length > 0
      ? `${input.requesterName} (${input.requesterEmployeeNumber})`
      : input.requesterName

  const subject = sanitizeSubject(
    `[Purchaser Queue] Material Request #${input.requestNumber} — ${input.companyName}`
  )

  const resend = new Resend(resendApiKey)
  const failedRecipients: Array<{ userId: string; email: string; error: string }> = []
  let sentCount = 0

  for (const recipient of input.recipients) {
    const safeRecipientName = escapeHtml(recipient.name || "Purchaser")
    const safeCompanyName = escapeHtml(input.companyName)
    const safeRequestType = escapeHtml(input.requestTypeLabel)
    const safeRequestNumber = escapeHtml(input.requestNumber)
    const safeRequesterLabel = escapeHtml(requesterLabel)
    const safeDepartmentName = escapeHtml(input.departmentName)
    const safeDatePreparedLabel = escapeHtml(input.datePreparedLabel)
    const safeDateRequiredLabel = escapeHtml(input.dateRequiredLabel)
    const safeAmountLabel = escapeHtml(input.amountLabel)
    const safeApprovalUrl = escapeHtml(approvalUrl)
    const safeSubmittedAt = escapeHtml(submittedAt)

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${sanitizeSubject(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="background-color:#2563eb;padding:20px 28px;border-radius:8px 8px 0 0;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:rgba(255,255,255,0.65);">${safeCompanyName}</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff;">Material Request Ready for Processing</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:24px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#334155;">Hello <strong>${safeRecipientName}</strong>,</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
                A <strong>${safeRequestType.toLowerCase()}</strong> has completed approval and is now queued for purchaser processing.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:20px;">
                <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Request #</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;">${safeRequestNumber}</td></tr>
                <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Requester</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;">${safeRequesterLabel}</td></tr>
                <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Department</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;">${safeDepartmentName}</td></tr>
                <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Prepared / Required</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;">${safeDatePreparedLabel} to ${safeDateRequiredLabel}</td></tr>
                <tr><td style="padding:10px 16px;font-size:13px;color:#6b7280;">Amount</td><td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1e293b;">${safeAmountLabel}</td></tr>
                <tr><td colspan="2" style="padding:8px 16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">Queued on ${safeSubmittedAt} (PHT)</td></tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${safeApprovalUrl}" target="_blank" style="display:inline-block;background-color:#2563eb;padding:11px 36px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Open Processing Queue</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px;background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;text-align:center;">
                This is an automated notification from ${safeCompanyName} Payroll.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const text = [
      `Hello ${recipient.name || "Purchaser"},`,
      "",
      `A ${input.requestTypeLabel.toLowerCase()} has completed approval and is now queued for purchaser processing.`,
      "",
      `Request #: ${input.requestNumber}`,
      `Requester: ${requesterLabel}`,
      `Department: ${input.departmentName}`,
      `Prepared / Required: ${input.datePreparedLabel} to ${input.dateRequiredLabel}`,
      `Amount: ${input.amountLabel}`,
      "",
      `Open Processing Queue: ${approvalUrl}`,
      "",
      "---",
      `${input.companyName} Payroll System`,
    ].join("\n")

    try {
      const result = await resend.emails.send({
        from: fromAddress,
        to: recipient.email,
        subject,
        html,
        text,
      })

      if (result.error) {
        failedRecipients.push({
          userId: recipient.userId,
          email: recipient.email,
          error: result.error.message,
        })
        continue
      }

      sentCount += 1
    } catch (error) {
      failedRecipients.push({
        userId: recipient.userId,
        email: recipient.email,
        error: error instanceof Error ? error.message : "Unknown email send error.",
      })
    }
  }

  return {
    ok: true,
    sentCount,
    failedCount: failedRecipients.length,
    failedRecipients,
  }
}
