import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { getPublishedArticle, getPublishedArticles } from "@/lib/news"

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
  const articles = await getPublishedArticles()
  const article = articles.find((publishedArticle) => publishedArticle.id === params.id)

  if (!article) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[#1A1C1E] text-white">
      <Navigation />
      <div className="container mx-auto mb-16 grid gap-8 px-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
        <article className="min-w-0">
          <Link
            href="/#news-heading"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span aria-hidden="true">←</span>
            Back to home
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
        </article>

        <aside
          aria-labelledby="all-news-heading"
          className="self-start rounded-lg border border-white/5 bg-[#2C2F33] p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
        >
          <h2 id="all-news-heading" className="text-lg font-semibold">
            All published news
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Browse every community update.
          </p>
          <nav aria-label="All published news" className="mt-4">
            <ul className="space-y-2">
              {articles.map((listedArticle) => (
                <li key={listedArticle.id}>
                  <Link
                    href={`/news/${listedArticle.id}`}
                    aria-current={
                      listedArticle.id === article.id ? "page" : undefined
                    }
                    className={`block rounded-md border px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      listedArticle.id === article.id
                        ? "border-cyan-500/50 bg-cyan-950/30 text-white"
                        : "border-transparent text-gray-300 hover:border-white/10 hover:bg-[#34373C] hover:text-white"
                    }`}
                  >
                    <span className="block font-medium leading-snug">
                      {listedArticle.title}
                    </span>
                    <time
                      dateTime={listedArticle.date}
                      className="mt-1 block text-xs text-gray-400"
                    >
                      {new Date(
                        `${listedArticle.date}T00:00:00`,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </main>
  )
}
