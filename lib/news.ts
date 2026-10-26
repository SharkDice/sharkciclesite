import { randomUUID } from "crypto"
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises"
import path from "path"
import { z } from "zod"

const articleDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    {
      message: "Enter a valid publication date.",
    },
  )

const newsImage = z
  .string()
  .regex(/^\/news\/[0-9a-f-]{36}\.(png|jpg|webp)$/i)

export const newsArticleSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    date: articleDate,
    summary: z.string().trim().max(280),
    content: z.string().trim().min(1).max(20000),
    image: newsImage.optional(),
    status: z.enum(["draft", "published"]),
    updatedAt: z.string().datetime(),
  })
  .strict()

const newsArticlesSchema = z.array(newsArticleSchema)
export type NewsArticle = z.infer<typeof newsArticleSchema>

const dataDirectory = path.join(process.cwd(), "data")
const newsFile = path.join(dataDirectory, "news.json")
const publicNewsDirectory = path.join(process.cwd(), "public", "news")

export async function removeNewsImage(image?: string): Promise<void> {
  if (!image || !newsImage.safeParse(image).success) {
    return
  }

  try {
    await unlink(path.join(publicNewsDirectory, path.basename(image)))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }
}

export async function saveNewsImage(
  filename: string,
  contents: Uint8Array,
): Promise<void> {
  await mkdir(publicNewsDirectory, { recursive: true })
  await writeFile(path.join(publicNewsDirectory, filename), contents, {
    flag: "wx",
  })
}

export async function getAllArticles(): Promise<NewsArticle[]> {
  const contents = await readFile(newsFile, "utf8")
  const parsed = newsArticlesSchema.safeParse(JSON.parse(contents))

  if (!parsed.success) {
    throw new Error(`News data is invalid: ${parsed.error.message}`)
  }

  return parsed.data.sort(
    (first, second) =>
      second.date.localeCompare(first.date) ||
      second.updatedAt.localeCompare(first.updatedAt),
  )
}

export async function getPublishedArticles(): Promise<NewsArticle[]> {
  return (await getAllArticles()).filter(
    (article) => article.status === "published",
  )
}

export async function getPublishedArticle(
  id: string,
): Promise<NewsArticle | undefined> {
  const articles = await getPublishedArticles()
  return articles.find((article) => article.id === id)
}

export async function saveArticles(articles: NewsArticle[]): Promise<void> {
  await mkdir(dataDirectory, { recursive: true })
  const temporaryFile = path.join(dataDirectory, `news-${randomUUID()}.tmp`)

  try {
    await writeFile(temporaryFile, `${JSON.stringify(articles, null, 2)}\n`, "utf8")
    await rename(temporaryFile, newsFile)
  } catch (error) {
    await unlink(temporaryFile).catch(() => undefined)
    throw error
  }
}
