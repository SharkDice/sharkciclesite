import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  getAllArticles,
  newsArticleSchema,
  removeNewsImage,
  saveArticles,
  type NewsArticle,
} from "@/lib/news"
import { authorizeNewsAdmin } from "@/lib/news-auth"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const articleInputSchema = newsArticleSchema
  .omit({ id: true, updatedAt: true })
  .extend({ id: z.string().min(1).optional() })

const deleteInputSchema = z.object({ id: z.string().min(1) }).strict()

function storageError(error: unknown, action: string): NextResponse {
  console.error(`Unable to ${action} news articles:`, error)
  return NextResponse.json(
    { error: `Unable to ${action} news articles. Check the server logs for details.` },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeNewsAdmin(request)
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json(await getAllArticles(), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return storageError(error, "read")
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = authorizeNewsAdmin(request)
  if (unauthorized) return unauthorized

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const parsedInput = articleInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: parsedInput.error.issues[0]?.message ?? "Article details are invalid." },
      { status: 400 },
    )
  }

  try {
    const articles = await getAllArticles()
    const articleId = parsedInput.data.id
    const existingIndex = articleId
      ? articles.findIndex((article) => article.id === articleId)
      : -1

    if (articleId && existingIndex < 0) {
      return NextResponse.json({ error: "Article not found." }, { status: 404 })
    }

    const previousImage =
      existingIndex >= 0 ? articles[existingIndex].image : undefined
    const article: NewsArticle = {
      ...parsedInput.data,
      id: articleId ?? randomUUID(),
      updatedAt: new Date().toISOString(),
    }

    if (existingIndex >= 0) {
      articles[existingIndex] = article
    } else {
      articles.push(article)
    }

    await saveArticles(articles)
    let warning: string | undefined
    if (previousImage && previousImage !== article.image) {
      try {
        await removeNewsImage(previousImage)
      } catch (error) {
        console.error("Unable to remove replaced news image:", error)
        warning = "The article was saved, but its previous image could not be removed."
      }
    }
    return NextResponse.json({ article, warning })
  } catch (error) {
    return storageError(error, "save")
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = authorizeNewsAdmin(request)
  if (unauthorized) return unauthorized

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const parsedInput = deleteInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return NextResponse.json({ error: "A valid article ID is required." }, { status: 400 })
  }

  try {
    const articles = await getAllArticles()
    const articleToDelete = articles.find(
      (article) => article.id === parsedInput.data.id,
    )

    if (!articleToDelete) {
      return NextResponse.json({ error: "Article not found." }, { status: 404 })
    }

    const remainingArticles = articles.filter(
      (article) => article.id !== parsedInput.data.id,
    )
    await saveArticles(remainingArticles)
    let warning: string | undefined
    try {
      await removeNewsImage(articleToDelete.image)
    } catch (error) {
      console.error("Unable to remove deleted news image:", error)
      warning = "The article was deleted, but its image could not be removed."
    }
    return NextResponse.json({ success: true, warning })
  } catch (error) {
    return storageError(error, "delete")
  }
}
