"use client"

import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import type { CalendarEvent } from "@/lib/events"

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function localDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function todayAsUtcDate(): Date {
  const today = new Date().toISOString().slice(0, 10)
  return localDate(today)
}

function formatDate(value: string): string {
  return localDate(value).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function EventsCalendar({ events }: { events: CalendarEvent[] }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return todayAsUtcDate()
  })
  const [month, setMonth] = useState<Date>(() => {
    const today = todayAsUtcDate()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const selectedDateString = localDateString(selectedDate)
  const today = new Date().toISOString().slice(0, 10)
  const upcomingEvents = events.filter((event) => event.endDate >= today)
  const selectedEvents = events.filter(
    (event) => event.date <= selectedDateString && event.endDate >= selectedDateString,
  )

  function selectUpcomingEvent(event: CalendarEvent) {
    const eventDate = localDate(event.date)
    setSelectedDate(eventDate)
    setMonth(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1))
    document
      .getElementById("events-calendar-view")
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <section
      className="container mx-auto mb-16 px-4"
      aria-labelledby="events-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            On the server
          </p>
          <h2 id="events-heading" className="mt-2 text-3xl font-bold">
            Upcoming Events
          </h2>
          <p className="mt-2 text-gray-400">
            Find out what’s happening next on Sharkcicle SMP.
          </p>
        </div>

        <div
          id="events-calendar-view"
          className="grid gap-6 rounded-lg border border-white/5 bg-[#2C2F33] p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <div className="flex justify-center rounded-md bg-[#1A1C1E] p-2 sm:p-4">
            <Calendar
              mode="single"
              month={month}
              onMonthChange={setMonth}
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date)
                }
              }}
              modifiers={{
                hasEvent: events.map((event) => ({
                  from: localDate(event.date),
                  to: localDate(event.endDate),
                })),
              }}
              modifiersClassNames={{
                hasEvent:
                  "relative font-bold text-cyan-300 after:absolute after:bottom-0 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-cyan-300",
              }}
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
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">
                Events on {formatDate(selectedDateString)}
              </h3>
              {selectedEvents.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {selectedEvents.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-md border border-cyan-400/20 bg-cyan-950/20 p-4"
                    >
                      <p className="font-semibold text-cyan-100">{event.title}</p>
                      <p className="mt-1 text-sm text-cyan-200">
                        {formatDate(event.date)}
                        {event.endDate !== event.date
                          ? ` – ${formatDate(event.endDate)}`
                          : ""}
                      </p>
                      {event.time && (
                        <p className="mt-1 text-sm text-cyan-200">
                          {event.time} (start time)
                        </p>
                      )}
                      {event.location && (
                        <p className="mt-1 text-sm text-gray-300">
                          {event.location}
                        </p>
                      )}
                      {event.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                          {event.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-400">
                  No events scheduled for this day. Select a highlighted date to
                  see event details.
                </p>
              )}
            </div>

            <div className="border-t border-white/10 pt-5">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarDays className="h-5 w-5 text-cyan-300" />
                Coming up
              </h3>
              {upcomingEvents.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {upcomingEvents.slice(0, 5).map((event) => (
                    <li key={event.id} className="border-l-2 border-cyan-400 pl-3">
                      <button
                        type="button"
                        onClick={() => selectUpcomingEvent(event)}
                        aria-label={`View ${event.title} on ${formatDate(event.date)} in the calendar`}
                        className="w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        <span className="block font-medium text-white hover:text-cyan-200">
                          {event.title}
                        </span>
                        <span className="mt-1 block text-sm text-gray-400">
                          {formatDate(event.date)}
                          {event.endDate !== event.date
                            ? ` – ${formatDate(event.endDate)}`
                            : ""}
                          {event.time ? ` · ${event.time}` : ""}
                        </span>
                        {event.location && (
                          <span className="mt-1 block text-sm text-gray-400">
                            {event.location}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-400">
                  No upcoming events are scheduled yet. Check back soon!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
