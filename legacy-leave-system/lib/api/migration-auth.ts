import { NextRequest, NextResponse } from "next/server"

export const requireMigrationToken = (request: NextRequest): NextResponse | null => {
  const configuredToken = process.env.LEGACY_MIGRATION_API_TOKEN || process.env.CRON_SECRET

  if (!configuredToken) {
    return NextResponse.json(
      { error: "Legacy migration token is not configured on the server." },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Bearer token." }, { status: 401 })
  }

  const providedToken = authHeader.slice("Bearer ".length).trim()
  if (providedToken !== configuredToken) {
    return NextResponse.json({ error: "Invalid migration token." }, { status: 401 })
  }

  return null
}

export const resolveMigrationScopeId = (request: NextRequest): string | null => {
  const url = new URL(request.url)
  const businessUnitId = url.searchParams.get("businessUnitId")?.trim()
  if (businessUnitId) return businessUnitId

  const companyId = url.searchParams.get("companyId")?.trim()
  if (companyId) return companyId

  return null
}

