import crypto from "node:crypto"

import type { AuthenticatedCredentialsUser } from "@/modules/auth/utils/credentials-auth"

type MobileTokenType = "access" | "refresh"

type MobileTokenPayload = {
  sub: string
  typ: MobileTokenType
  iat: number
  exp: number
  jti: string
  companyId: string
  role: string
  companyRole: string | null
  employeeId: string | null
  employeeNumber: string | null
}

export type MobileAccessTokenClaims = MobileTokenPayload & { typ: "access" }
export type MobileRefreshTokenClaims = MobileTokenPayload & { typ: "refresh" }

const ACCESS_TOKEN_TTL_SECONDS = 30 * 60
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

const getSecret = (): string => {
  const secret = process.env.AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("AUTH_SECRET is required for mobile token signing.")
  }
  return secret
}

const base64UrlEncode = (input: Buffer | string): string => {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

const base64UrlDecode = (input: string): string => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4)
  return Buffer.from(normalized + "=".repeat(padLength), "base64").toString("utf8")
}

const sign = (data: string, secret: string): string => {
  const digest = crypto.createHmac("sha256", secret).update(data).digest()
  return base64UrlEncode(digest)
}

const timingSafeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

const buildToken = (payload: MobileTokenPayload): string => {
  const header = {
    alg: "HS256",
    typ: "JWT",
  }

  const secret = getSecret()
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = sign(data, secret)

  return `${data}.${signature}`
}

const verifyToken = (token: string): MobileTokenPayload | null => {
  const parts = token.split(".")
  if (parts.length !== 3) {
    return null
  }

  const [encodedHeader, encodedPayload, signature] = parts
  const data = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = sign(data, getSecret())

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as MobileTokenPayload
    if (!payload.sub || !payload.typ || !payload.exp || !payload.iat || !payload.companyId) {
      return null
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const toTokenPayload = (params: {
  user: AuthenticatedCredentialsUser
  type: MobileTokenType
  ttlSeconds: number
}): MobileTokenPayload => {
  const issuedAt = nowSeconds()
  return {
    sub: params.user.id,
    typ: params.type,
    iat: issuedAt,
    exp: issuedAt + params.ttlSeconds,
    jti: crypto.randomUUID(),
    companyId: params.user.companyId ?? "",
    role: params.user.role,
    companyRole: params.user.companyRole,
    employeeId: params.user.employeeId,
    employeeNumber: params.user.employeeNumber,
  }
}

export type IssuedMobileTokens = {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
}

export const issueMobileTokens = (user: AuthenticatedCredentialsUser): IssuedMobileTokens => {
  if (!user.companyId) {
    throw new Error("Unable to issue mobile token without company context.")
  }

  const accessPayload = toTokenPayload({
    user,
    type: "access",
    ttlSeconds: ACCESS_TOKEN_TTL_SECONDS,
  })
  const refreshPayload = toTokenPayload({
    user,
    type: "refresh",
    ttlSeconds: REFRESH_TOKEN_TTL_SECONDS,
  })

  return {
    accessToken: buildToken(accessPayload),
    refreshToken: buildToken(refreshPayload),
    expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
  }
}

export const verifyMobileAccessToken = (token: string): MobileAccessTokenClaims | null => {
  const payload = verifyToken(token)
  if (!payload || payload.typ !== "access") {
    return null
  }
  return {
    ...payload,
    typ: "access",
  }
}

export const verifyMobileRefreshToken = (token: string): MobileRefreshTokenClaims | null => {
  const payload = verifyToken(token)
  if (!payload || payload.typ !== "refresh") {
    return null
  }
  return {
    ...payload,
    typ: "refresh",
  }
}
