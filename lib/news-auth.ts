import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"

export function authorizeNewsAdmin(request: NextRequest): NextResponse | null {
  const expected = process.env.NEWS_ADMIN_PASSWORD

  if (!expected) {
    return NextResponse.json(
      {
        error:
          "News editing is not configured. Set NEWS_ADMIN_PASSWORD and restart the server.",
      },
      { status: 503 },
    )
  }

  const provided = request.headers.get("x-news-admin-password")
  if (!provided || provided.length > 1024) {
    return NextResponse.json(
      { error: "Incorrect admin password." },
      { status: 401 },
    )
  }

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  const authorized =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)

  if (!authorized) {
    return NextResponse.json(
      { error: "Incorrect admin password." },
      { status: 401 },
    )
  }

  return null
}
