"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, FilePlus2, ImagePlus, Loader2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { NewsArticle } from "@/lib/news"

type ArticleForm = Pick<
  NewsArticle,
  "title" | "date" | "summary" | "content" | "status" | "image"
>

function todayAsLocalDate(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function emptyForm(): ArticleForm {
  return {
    title: "",
    date: todayAsLocalDate(),
    summary: "",
    content: "",
    status: "draft",
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error ?? "The request could not be completed.")
  }
  return result as T
}

export function NewsManager() {
  const [password, setPassword] = useState("")
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [form, setForm] = useState<ArticleForm>(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }

    const previewUrl = URL.createObjectURL(imageFile)
    setImagePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [imageFile])

  async function loadArticles(candidatePassword: string) {
    setLoading(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/news", {
        headers: { "x-news-admin-password": candidatePassword },
        cache: "no-store",
      })
      const result = await readResponse<NewsArticle[]>(response)
      setArticles(result)
      setPassword(candidatePassword)
      setAuthenticated(true)
    } catch (loadError) {
      setAuthenticated(false)
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load news articles.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadArticles(password)
  }

  function selectArticle(article: NewsArticle) {
    setEditingId(article.id)
    setImageFile(null)
    setForm({
      title: article.title,
      date: article.date,
      summary: article.summary,
      content: article.content,
      status: article.status,
      image: article.image,
    })
    setError("")
    setNotice("")
  }

  function startNewArticle() {
    setEditingId(null)
    setImageFile(null)
    setForm(emptyForm())
    setError("")
    setNotice("")
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setNotice("")

    try {
      let image = form.image
      if (imageFile) {
        const uploadData = new FormData()
        uploadData.set("image", imageFile)
        const uploadResponse = await fetch("/api/news/upload", {
          method: "POST",
          headers: { "x-news-admin-password": password },
          body: uploadData,
        })
        const uploadResult = await readResponse<{ image: string }>(uploadResponse)
        image = uploadResult.image
      }

      const response = await fetch("/api/news", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-news-admin-password": password,
        },
        body: JSON.stringify({
          ...form,
          image,
          ...(editingId ? { id: editingId } : {}),
        }),
      })
      const result = await readResponse<{
        article: NewsArticle
        warning?: string
      }>(response)
      setArticles((current) =>
        [result.article, ...current.filter((article) => article.id !== result.article.id)]
          .sort(
            (first, second) =>
              second.date.localeCompare(first.date) ||
              second.updatedAt.localeCompare(first.updatedAt),
          ),
      )
      setEditingId(result.article.id)
      setForm((current) => ({ ...current, image: result.article.image }))
      setImageFile(null)
      setNotice(
        [
          result.article.status === "published" ? "Article published." : "Draft saved.",
          result.warning,
        ]
          .filter(Boolean)
          .join(" "),
      )
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save this article.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(article: NewsArticle) {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) {
      return
    }

    setLoading(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/news", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-news-admin-password": password,
        },
        body: JSON.stringify({ id: article.id }),
      })
      const result = await readResponse<{ success: true; warning?: string }>(response)
      setArticles((current) => current.filter((item) => item.id !== article.id))
      if (editingId === article.id) {
        startNewArticle()
      }
      setNotice(result.warning ?? "Article deleted.")
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete this article.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to homepage
      </Link>

      <header className="mb-8 mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Sharkcicle SMP
        </p>
        <h1 className="mt-2 text-3xl font-bold">News editor</h1>
        <p className="mt-2 text-gray-400">
          Write a community update, save it as a draft, or publish it to the homepage.
        </p>
      </header>

      {!authenticated ? (
        <form
          onSubmit={handleLogin}
          className="max-w-lg rounded-lg border border-white/5 bg-[#2C2F33] p-6"
        >
          <label htmlFor="admin-password" className="mb-2 block text-sm font-medium">
            Admin password
          </label>
          <Input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="border-gray-600 bg-[#1A1C1E] text-white"
          />
          <p className="mt-3 text-sm text-gray-400">
            Configure <code className="text-gray-200">NEWS_ADMIN_PASSWORD</code> in{" "}
            <code className="text-gray-200">.env.local</code>, then restart the dev
            server.
          </p>
          {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-5">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <aside className="rounded-lg border border-white/5 bg-[#2C2F33] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Articles</h2>
              <Button type="button" onClick={startNewArticle} size="sm">
                <FilePlus2 className="mr-2 h-4 w-4" />
                New
              </Button>
            </div>
            {articles.length === 0 ? (
              <p className="text-sm text-gray-400">No articles yet. Create your first update.</p>
            ) : (
              <ul className="space-y-2">
                {articles.map((article) => (
                  <li
                    key={article.id}
                    className={`rounded-md border p-3 ${
                      editingId === article.id
                        ? "border-cyan-500/60 bg-cyan-950/30"
                        : "border-white/5 bg-[#232629]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => selectArticle(article)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate font-medium">{article.title}</span>
                        <span className="mt-1 block text-xs text-gray-400">
                          {article.status === "published" ? "Published" : "Draft"} ·{" "}
                          {article.date}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${article.title}`}
                        disabled={loading}
                        onClick={() => void handleDelete(article)}
                        className="shrink-0 text-gray-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <form
            onSubmit={handleSave}
            className="space-y-5 rounded-lg border border-white/5 bg-[#2C2F33] p-5 sm:p-7"
          >
            <div>
              <h2 className="text-xl font-semibold">
                {editingId ? "Edit article" : "New article"}
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Published articles appear in News &amp; Updates on the homepage.
              </p>
            </div>

            <div>
              <label htmlFor="article-title" className="mb-2 block text-sm font-medium">
                Title
              </label>
              <Input
                id="article-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                maxLength={120}
                required
                className="border-gray-600 bg-[#1A1C1E] text-white"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="article-date" className="mb-2 block text-sm font-medium">
                  Publication date
                </label>
                <Input
                  id="article-date"
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date: event.target.value }))
                  }
                  required
                  className="border-gray-600 bg-[#1A1C1E] text-white"
                />
              </div>
              <div>
                <label htmlFor="article-status" className="mb-2 block text-sm font-medium">
                  Status
                </label>
                <select
                  id="article-status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status:
                        event.target.value === "published" ? "published" : "draft",
                    }))
                  }
                  className="h-10 w-full rounded-md border border-gray-600 bg-[#1A1C1E] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="article-summary" className="mb-2 block text-sm font-medium">
                Short summary <span className="text-gray-400">(optional)</span>
              </label>
              <Textarea
                id="article-summary"
                value={form.summary}
                onChange={(event) =>
                  setForm((current) => ({ ...current, summary: event.target.value }))
                }
                maxLength={280}
                rows={2}
                className="border-gray-600 bg-[#1A1C1E] text-white"
              />
              <p className="mt-1 text-right text-xs text-gray-500">
                {form.summary.length}/280
              </p>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium">Article photo</span>
              {imagePreview || form.image ? (
                <div className="mb-3 overflow-hidden rounded-md border border-gray-600 bg-[#1A1C1E]">
                  <Image
                    src={imagePreview ?? form.image ?? ""}
                    alt={form.title ? `Photo for ${form.title}` : "Article photo preview"}
                    width={1200}
                    height={675}
                    unoptimized
                    className="max-h-80 w-full object-contain"
                  />
                </div>
              ) : (
                <p className="mb-3 text-sm text-gray-400">
                  Add an optional photo to make this update stand out.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="article-image"
                  className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-gray-600 bg-[#1A1C1E] px-4 text-sm font-medium text-white hover:bg-[#34373C]"
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Choose photo
                </label>
                <input
                  id="article-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={loading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (!file) return

                    if (file.size > 5 * 1024 * 1024) {
                      setError("Image must be 5 MB or smaller.")
                      return
                    }
                    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                      setError("Choose a PNG, JPEG, or WebP image.")
                      return
                    }

                    setError("")
                    setImageFile(file)
                  }}
                />
                {(imagePreview || form.image) && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    onClick={() => {
                      setImageFile(null)
                      setForm((current) => ({ ...current, image: undefined }))
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove photo
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                PNG, JPEG, or WebP. Maximum file size: 5 MB.
              </p>
            </div>

            <div>
              <label htmlFor="article-content" className="mb-2 block text-sm font-medium">
                Article
              </label>
              <Textarea
                id="article-content"
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({ ...current, content: event.target.value }))
                }
                maxLength={20000}
                rows={12}
                required
                placeholder="Write your weekly update here. Separate paragraphs with a blank line."
                className="border-gray-600 bg-[#1A1C1E] text-white"
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.status === "published" ? "Publish article" : "Save draft"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAuthenticated(false)
                  setPassword("")
                  setArticles([])
                  startNewArticle()
                }}
              >
                Sign out
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
