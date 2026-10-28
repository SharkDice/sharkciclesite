'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock3, RefreshCw, Trophy } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PlaytimePlayer {
  name: string
  minutes: number
}

interface PlaytimeResponse {
  success: boolean
  timestamp?: string
  historyReady?: boolean
  weekly?: PlaytimePlayer[]
  lifetime?: PlaytimePlayer[]
  error?: string
}

function formatPlaytime(minutes: number) {
  const totalDays = Math.floor(minutes / 1440)
  const months = Math.floor(totalDays / 30)
  const days = totalDays % 30
  const hours = Math.floor((minutes % 1440) / 60)
  const remainingMinutes = minutes % 60

  const units = [
    [months, 'month'],
    [days, 'day'],
    [hours, 'hour'],
    [remainingMinutes, 'minute'],
  ] as const
  const parts = units
    .filter(([value, unit]) => value > 0 || unit === 'minute')
    .map(([value, unit]) => `${value} ${unit}${value === 1 ? '' : 's'}`)

  return parts.join(', ')
}

function PlayerAvatar({ name }: { name: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <svg
        viewBox="0 0 8 8"
        width={32}
        height={32}
        className="shrink-0 rounded"
        aria-hidden="true"
        shapeRendering="crispEdges"
      >
        <rect width="8" height="8" fill="#c58f63" />
        <rect width="8" height="2" fill="#49352b" />
        <rect y="2" width="2" height="3" fill="#49352b" />
        <rect x="6" y="2" width="2" height="3" fill="#49352b" />
        <rect x="2" y="3" width="1" height="1" fill="#fff" />
        <rect x="5" y="3" width="1" height="1" fill="#fff" />
        <rect x="2" y="3" width="1" height="1" fill="#4776a8" />
        <rect x="5" y="3" width="1" height="1" fill="#4776a8" />
        <rect x="3" y="6" width="2" height="1" fill="#754631" />
      </svg>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://minotar.net/avatar/${encodeURIComponent(name)}/32`}
      alt=""
      width={32}
      height={32}
      className="shrink-0 rounded"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function PlaytimeLeaderboard({
  players,
  emptyMessage,
  showTotalMinutes = false,
}: {
  players: PlaytimePlayer[]
  emptyMessage: string
  showTotalMinutes?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        {players.length > 0 ? (
          <ol className="space-y-3">
            {players.map((player, index) => (
              <li key={player.name} className="flex items-center gap-3">
                <span className="w-7 shrink-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                <PlayerAvatar name={player.name} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
                <span className="shrink-0 text-right">
                  <span className="font-semibold tabular-nums">{formatPlaytime(player.minutes)}</span>
                  {showTotalMinutes && (
                    <span className="block text-xs text-muted-foreground">
                      {player.minutes.toLocaleString()} total minutes
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function PlaytimeStats() {
  const [stats, setStats] = useState<PlaytimeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchPlaytime() {
      try {
        const response = await fetch('/api/time-played', { signal: controller.signal })
        const data: PlaytimeResponse = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch playtime statistics')
        }
        setStats(data)
        setError(null)
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch playtime statistics')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchPlaytime()
    const interval = setInterval(fetchPlaytime, 60000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  if (loading && !stats && !error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-12">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <p>Loading playtime statistics...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}. Check the playtime service settings on the Minecraft server.</AlertDescription>
        </Alert>
      )}

      {stats && (
        <>
          {stats.timestamp && (
            <p className="text-sm text-muted-foreground">
              Playtime data updated: {new Date(stats.timestamp).toLocaleTimeString()}
            </p>
          )}
          <Tabs defaultValue="seven-days" className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl border bg-card p-1">
              <TabsTrigger value="seven-days">Last 7 days</TabsTrigger>
              <TabsTrigger value="lifetime">Lifetime</TabsTrigger>
            </TabsList>
            <TabsContent value="seven-days" className="space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-semibold">Most Time Played in the Last 7 Days</h2>
              </div>
              {!stats.historyReady && (
                <Card>
                  <CardContent className="py-4">
                    <p className="text-center text-muted-foreground">
                      Showing playtime tracked so far. The leaderboard will cover a full seven days after the service has collected seven days of history.
                    </p>
                  </CardContent>
                </Card>
              )}
              <PlaytimeLeaderboard
                players={stats.weekly ?? []}
                emptyMessage="No player playtime has been recorded in the available period."
              />
            </TabsContent>
            <TabsContent value="lifetime" className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-semibold">Lifetime Playtime</h2>
              </div>
              <PlaytimeLeaderboard
                players={stats.lifetime ?? []}
                emptyMessage="No lifetime playtime scores were found."
                showTotalMinutes
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
