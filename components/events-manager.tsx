"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Loader2,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CalendarEvent } from "@/lib/events"

type EventForm = Omit<CalendarEvent, "id">

function todayAsLocalDate(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function emptyForm(): EventForm {
  const today = todayAsLocalDate()
  return {
    title: "",
    date: today,
    endDate: today,
    time: "",
    location: "",
    description: "",
  }
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(value: string): string {
  return localDate(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(startDate)} – ${formatDate(endDate)}`
}

function EventDatePicker({
  label,
  value,
  minimumDate,
  onChange,
}: {
  label: string
  value: string
  minimumDate?: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedDate = localDate(value)

  return (
    <div>
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={`${label}: ${formatDate(value)}. Choose date`}
            aria-expanded={open}
            className="w-full justify-start border-gray-600 bg-[#1A1C1E] text-left font-normal text-white hover:bg-[#34373C] hover:text-white"
          >
            <CalendarDays className="mr-2 h-4 w-4 text-cyan-300" />
            {formatDate(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto border-gray-600 bg-[#1A1C1E] p-0 text-white"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              if (date) {
                const year = date.getFullYear()
                const month = String(date.getMonth() + 1).padStart(2, "0")
                const day = String(date.getDate()).padStart(2, "0")
                onChange(`${year}-${month}-${day}`)
                setOpen(false)
              }
            }}
            disabled={
              minimumDate
                ? (date) => date < localDate(minimumDate)
                : undefined
            }
            className="text-white"
            classNames={{
              caption_label: "text-sm font-medium text-white",
              nav_button:
                "h-7 w-7 rounded border border-white/10 bg-transparent p-0 text-white opacity-80 hover:bg-white/10 hover:opacity-100",
              head_cell: "w-9 rounded-md text-xs font-normal text-gray-500",
              day: "h-9 w-9 rounded-md p-0 text-sm font-normal text-gray-200 hover:bg-white/10",
              day_selected:
                "bg-cyan-500 text-white hover:bg-cyan-400 hover:text-white focus:bg-cyan-500 focus:text-white",
              day_today: "bg-white/10 font-semibold text-cyan-300",
              day_outside: "text-gray-600 opacity-60",
              day_disabled: "text-gray-600 opacity-50",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error ?? "The request could not be completed.")
  }
  return result as T
}

export function EventsManager() {
  const [password, setPassword] = useState("")
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function loadEvents(candidatePassword: string) {
    setLoading(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/events", {
        headers: { "x-news-admin-password": candidatePassword },
        cache: "no-store",
      })
      const result = await readResponse<CalendarEvent[]>(response)
      setEvents(result)
      setPassword(candidatePassword)
      setAuthenticated(true)
    } catch (loadError) {
      setAuthenticated(false)
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load events.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadEvents(password)
  }

  function startNewEvent() {
    setEditingId(null)
    setForm(emptyForm())
    setError("")
    setNotice("")
  }

  function selectEvent(event: CalendarEvent) {
    setEditingId(event.id)
    setForm({
      title: event.title,
      date: event.date,
      endDate: event.endDate,
      time: event.time ?? "",
      location: event.location,
      description: event.description,
    })
    setError("")
    setNotice("")
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-news-admin-password": password,
        },
        body: JSON.stringify({
          ...form,
          ...(editingId ? { id: editingId } : {}),
        }),
      })
      const result = await readResponse<{ event: CalendarEvent }>(response)
      setEvents((current) =>
        [...current.filter((item) => item.id !== result.event.id), result.event].sort(
          (first, second) =>
            first.date.localeCompare(second.date) ||
            (first.time || "").localeCompare(second.time || "") ||
            first.title.localeCompare(second.title),
        ),
      )
      setEditingId(result.event.id)
      setNotice("Event saved.")
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save this event.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(event: CalendarEvent) {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      return
    }

    setLoading(true)
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/events", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-news-admin-password": password,
        },
        body: JSON.stringify({ id: event.id }),
      })
      await readResponse<{ success: true }>(response)
      setEvents((current) => current.filter((item) => item.id !== event.id))
      if (editingId === event.id) {
        startNewEvent()
      }
      setNotice("Event deleted.")
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete this event.",
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
        <h1 className="mt-2 text-3xl font-bold">Events calendar editor</h1>
        <p className="mt-2 text-gray-400">
          Create and manage upcoming server events.
        </p>
        <Link
          href="/admin/news"
          className="mt-3 inline-block text-sm text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
        >
          Open news editor
        </Link>
      </header>

      {!authenticated ? (
        <form
          onSubmit={handleLogin}
          className="max-w-lg rounded-lg border border-white/5 bg-[#2C2F33] p-6"
        >
          <label htmlFor="events-admin-password" className="mb-2 block text-sm font-medium">
            Admin password
          </label>
          <Input
            id="events-admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="border-gray-600 bg-[#1A1C1E] text-white"
          />
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
              <h2 className="text-lg font-semibold">Events</h2>
              <Button type="button" onClick={startNewEvent} size="sm">
                <CalendarPlus className="mr-2 h-4 w-4" />
                New
              </Button>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400">
                No events yet. Create your first server event.
              </p>
            ) : (
              <ul className="space-y-2">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className={`rounded-md border p-3 ${
                      editingId === event.id
                        ? "border-cyan-500/60 bg-cyan-950/30"
                        : "border-white/5 bg-[#232629]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => selectEvent(event)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate font-medium">{event.title}</span>
                        <span className="mt-1 block text-xs text-gray-400">
                          {formatDateRange(event.date, event.endDate)}
                          {event.time ? ` · ${event.time}` : ""}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${event.title}`}
                        disabled={loading}
                        onClick={() => void handleDelete(event)}
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
                {editingId ? "Edit event" : "New event"}
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Saved events appear on the public homepage calendar.
              </p>
            </div>

            <div>
              <label htmlFor="event-title" className="mb-2 block text-sm font-medium">
                Event name
              </label>
              <Input
                id="event-title"
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
                <EventDatePicker
                  label="Start date"
                  value={form.date}
                  onChange={(date) =>
                    setForm((current) => ({
                      ...current,
                      date,
                      endDate: current.endDate < date ? date : current.endDate,
                    }))
                  }
                />
              </div>
              <div>
                <EventDatePicker
                  label="End date"
                  value={form.endDate}
                  minimumDate={form.date}
                  onChange={(endDate) =>
                    setForm((current) => ({ ...current, endDate }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="event-time" className="mb-2 block text-sm font-medium">
                  Time <span className="text-gray-400">(optional)</span>
                </label>
                <Input
                  id="event-time"
                  type="time"
                  value={form.time ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, time: event.target.value }))
                  }
                  className="border-gray-600 bg-[#1A1C1E] text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="event-location" className="mb-2 block text-sm font-medium">
                Location <span className="text-gray-400">(optional)</span>
              </label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))
                }
                maxLength={120}
                className="border-gray-600 bg-[#1A1C1E] text-white"
              />
            </div>

            <div>
              <label htmlFor="event-description" className="mb-2 block text-sm font-medium">
                Details <span className="text-gray-400">(optional)</span>
              </label>
              <Textarea
                id="event-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                maxLength={2000}
                rows={5}
                className="border-gray-600 bg-[#1A1C1E] text-white"
              />
              <p className="mt-1 text-right text-xs text-gray-500">
                {form.description.length}/2000
              </p>
            </div>

            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save event
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startNewEvent}
                  disabled={loading}
                >
                  Create another
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
