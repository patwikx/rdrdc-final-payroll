import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createPresignedDownloadUrl } from "@/lib/minio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  companyId: z.string().uuid(),
  key: z.string().min(1).max(500),
})

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId"),
    key: request.nextUrl.searchParams.get("key"),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid logo request." }, { status: 400 })
  }

  const { companyId, key } = parsed.data
  const expectedPrefix = `private/companies/${companyId}/logos/`
  if (!key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid logo path." }, { status: 400 })
  }

  try {
    const signedUrl = await createPresignedDownloadUrl(key, 60)
    return NextResponse.redirect(signedUrl, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    })
  } catch {
    return NextResponse.json({ error: "Unable to load logo." }, { status: 500 })
  }
}

