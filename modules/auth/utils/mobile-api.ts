import { NextResponse } from "next/server"

export const mobileOk = <T>(data: T, message?: string) =>
  NextResponse.json({
    ok: true as const,
    message: message ?? null,
    data,
  })

export const mobileError = (error: string, status = 400) =>
  NextResponse.json(
    {
      ok: false as const,
      error,
    },
    { status }
  )

export const getBearerToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) return null
  const [scheme, token] = authorizationHeader.split(" ")
  if (!scheme || !token) return null
  if (scheme.toLowerCase() !== "bearer") return null
  return token.trim() || null
}
