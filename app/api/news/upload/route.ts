import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { saveNewsImage } from "@/lib/news"
import { authorizeNewsAdmin } from "@/lib/news-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const maximumImageSize = 5 * 1024 * 1024

function getImageExtension(contents: Buffer): "png" | "jpg" | "webp" | null {
  if (
    contents.length >= 8 &&
    contents.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "png"
  }

  if (
    contents.length >= 3 &&
    contents[0] === 0xff &&
    contents[1] === 0xd8 &&
    contents[2] === 0xff
  ) {
    return "jpg"
  }

  if (
    contents.length >= 12 &&
    contents.toString("ascii", 0, 4) === "RIFF" &&
    contents.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp"
  }

  return null
}

export async function POST(request: NextRequest) {
  const unauthorized = authorizeNewsAdmin(request)
  if (unauthorized) return unauthorized

  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumImageSize + 64 * 1024) {
    return NextResponse.json(
      { error: "Image must be 5 MB or smaller." },
      { status: 413 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Choose a valid PNG, JPEG, or WebP image." },
      { status: 400 },
    )
  }

  const image = formData.get("image")
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 })
  }

  if (image.size === 0 || image.size > maximumImageSize) {
    return NextResponse.json(
      { error: "Image must be greater than 0 bytes and 5 MB or smaller." },
      { status: 413 },
    )
  }

  try {
    const contents = Buffer.from(await image.arrayBuffer())
    const extension = getImageExtension(contents)
    if (!extension) {
      return NextResponse.json(
        { error: "Only valid PNG, JPEG, and WebP images are supported." },
        { status: 400 },
      )
    }

    const filename = `${randomUUID()}.${extension}`
    await saveNewsImage(filename, contents)
    return NextResponse.json({ image: `/news/${filename}` })
  } catch (error) {
    console.error("Unable to upload news image:", error)
    return NextResponse.json(
      { error: "Unable to save image. Check the server logs for details." },
      { status: 500 },
    )
  }
}
