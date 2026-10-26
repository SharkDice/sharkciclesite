'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowDownLeft, ArrowUpRight, Clock3, RefreshCw } from 'lucide-react'

interface ActivityEvent {
  playerName: string
  eventType: 'join' | 'leave'
  occurredAt: string
  durationSeconds: number | null
}

interface ActivityResponse {
  success: boolean
  events: ActivityEvent[]
  error?: string
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return 'less than 1m'
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function ServerActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivity = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/server-activity', { cache: 'no-store' })
      const data: ActivityResponse = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to fetch recent activity')
      }
      setEvents(data.events)
      setError(null)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to fetch recent activity')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, 30000)
    return () => clearInterval(interval)
  }, [fetchActivity])

  return (
    <section className="rounded-lg bg-[#2C2F33] p-6" aria-labelledby="activity-heading">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
            Community
          </p>
          <h2 id="activity-heading" className="mt-1 text-2xl font-bold">
            Recent Activity
          </h2>
        </div>
        <button
          type="button"
          onClick={fetchActivity}
          disabled={loading}
          aria-label="Refresh recent activity"
          title="Refresh recent activity"
          className="rounded p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-wait"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p role="status" className="rounded-md bg-red-950/40 p-4 text-sm text-red-300">
          Recent activity is temporarily unavailable: {error}
        </p>
      ) : events.length > 0 ? (
        <ul className="divide-y divide-white/10">
          {events.map((event, index) => {
            const duration = formatDuration(event.durationSeconds)
            const joined = event.eventType === 'join'

            return (
              <li
                key={`${event.playerName}-${event.eventType}-${event.occurredAt}-${index}`}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Image
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(event.playerName)}/64`}
                  alt={`${event.playerName}'s Minecraft skin`}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 rounded bg-gray-700"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {joined ? (
                      <ArrowDownLeft className="h-4 w-4 flex-shrink-0 text-green-400" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-orange-300" aria-hidden="true" />
                    )}
                    <p className="truncate font-semibold text-white">
                      {event.playerName}{' '}
                      <span className={`font-normal ${joined ? 'text-green-300' : 'text-orange-200'}`}>
                        {joined ? 'joined' : 'left'}
                      </span>
                    </p>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                    <time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time>
                    {duration !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {joined ? `Playing for ${duration}` : `Played ${duration}`}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-md bg-black/10 p-4 text-sm text-gray-400">
          {loading
            ? 'Loading recent activity...'
            : 'No activity has been collected yet. New join and leave events will appear here.'}
        </p>
      )}
    </section>
  )
}
