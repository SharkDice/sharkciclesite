import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { getPublishedArticle } from "@/lib/news"

export const dynamic = "force-dynamic"

interface NewsArticlePageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({
  params,
}: NewsArticlePageProps): Promise<Metadata> {
  const article = await getPublishedArticle(params.id)

  if (!article) {
    return { title: "Article not found | Sharkcicle" }
  }

  return {
    title: `${article.title} | Sharkcicle News`,
    description: article.summary || article.title,
  }
}

export default async function NewsArticlePage({
  params,
}: NewsArticlePageProps) {
  const article = await getPublishedArticle(params.id)

  if (!article) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[#1A1C1E] text-white">
      <Navigation />
      <article className="container mx-auto mb-16 px-4">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/#news-heading"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span aria-hidden="true">←</span>
            Back to news
          </Link>

          <header className="mt-8">
            <time
              dateTime={article.date}
              className="text-sm font-medium text-cyan-300"
            >
              {new Date(`${article.date}T00:00:00`).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "long", day: "numeric" },
              )}
            </time>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              {article.title}
            </h1>
            {article.summary && (
              <p className="mt-4 text-lg text-gray-300">{article.summary}</p>
            )}
          </header>

          {article.image && (
            <Image
              src={article.image}
              alt={`Photo for ${article.title}`}
              width={1200}
              height={675}
              unoptimized
              priority
              className="mt-8 max-h-[32rem] w-full rounded-lg object-cover"
            />
          )}

          <div className="mt-8 space-y-5 text-base leading-7 text-gray-200">
            {article.content.split(/\n\s*\n/).map((paragraph, index) => (
              <p
                key={`${article.id}-${index}`}
                className="whitespace-pre-wrap"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </article>
    </main>
  )
}
