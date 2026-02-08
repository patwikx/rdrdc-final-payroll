import type { AuditAction, Prisma } from "@prisma/client"

import { db } from "@/lib/db"

type AuditDbClient = Prisma.TransactionClient | typeof db

type AuditChange = {
  fieldName: string
  oldValue?: unknown
  newValue?: unknown
}

export type AuditLogInput = {
  tableName: string
  recordId: string
  action: AuditAction
  userId?: string | null
  reason?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  changes?: AuditChange[]
}

const toStoredAuditValue = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const getRequestAuditMetadata = (request: Request): { ipAddress: string | null; userAgent: string | null } => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")

  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? realIp ?? null
  const userAgent = request.headers.get("user-agent")

  return {
    ipAddress,
    userAgent,
  }
}

export async function createAuditLog(input: AuditLogInput, client: AuditDbClient = db): Promise<void> {
  const basePayload = {
    tableName: input.tableName,
    recordId: input.recordId,
    action: input.action,
    reason: input.reason ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    userId: input.userId ?? null,
  }

  if (!input.changes || input.changes.length === 0) {
    await client.auditLog.create({
      data: basePayload,
    })
    return
  }

  await client.auditLog.createMany({
    data: input.changes.map((change) => ({
      ...basePayload,
      fieldName: change.fieldName,
      oldValue: toStoredAuditValue(change.oldValue),
      newValue: toStoredAuditValue(change.newValue),
    })),
  })
}
