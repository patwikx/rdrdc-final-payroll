import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createPresignedDownloadUrl } from "@/lib/minio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  key: z.string().min(1).max(500),
})

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId"),
    employeeId: request.nextUrl.searchParams.get("employeeId"),
    key: request.nextUrl.searchParams.get("key"),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signature request." }, { status: 400 })
  }

  const { companyId, employeeId, key } = parsed.data
  const expectedPrefix = `private/companies/${companyId}/employees/${employeeId}/signature/`
  if (!key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid signature path." }, { status: 400 })
  }

  try {
    const signedUrl = await createPresignedDownloadUrl(key, 60)
    return NextResponse.redirect(signedUrl, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    })
  } catch {
    return NextResponse.json({ error: "Unable to load signature." }, { status: 500 })
  }
}

