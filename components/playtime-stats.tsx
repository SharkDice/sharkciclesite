'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock3, RefreshCw, Trophy } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PlaytimePlayer {
  name: string
  minutes: number
  chatMessages?: number
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

function PlayerAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <svg
        viewBox="0 0 8 8"
        width={size}
        height={size}
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
      src={`https://minotar.net/avatar/${encodeURIComponent(name)}/${size}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

const RANK_STYLES = [
  'bg-yellow-400 text-yellow-950',
  'bg-gray-300 text-gray-800',
  'bg-amber-600 text-amber-50',
]

function WeeklyPlaytimeCard({
  player,
  rank,
  totalWeeklyChatMessages,
}: {
  player: PlaytimePlayer
  rank: number
  totalWeeklyChatMessages?: number
}) {
  const rankStyle = RANK_STYLES[rank - 1] ?? 'bg-muted text-muted-foreground'
  const chatPercentage = totalWeeklyChatMessages && totalWeeklyChatMessages > 0 && player.chatMessages !== undefined
    ? (player.chatMessages / totalWeeklyChatMessages) * 100
    : 0

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <PlayerAvatar name={player.name} size={48} />
            <span
              className={`absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow ${rankStyle}`}
            >
              {rank}
            </span>
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{player.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{formatPlaytime(player.minutes)}</span> played
            </p>
            <p className="text-xs text-muted-foreground">
              {player.minutes.toLocaleString()} minutes total
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {player.chatMessages !== undefined && totalWeeklyChatMessages !== undefined ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {player.chatMessages.toLocaleString()} chat message{player.chatMessages === 1 ? '' : 's'}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{chatPercentage.toFixed(1)}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${player.chatMessages.toLocaleString()} of ${totalWeeklyChatMessages.toLocaleString()} community chat messages, ${chatPercentage.toFixed(1)} percent`}
            >
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${chatPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              of {totalWeeklyChatMessages.toLocaleString()} community messages in the last 7 days
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chat message counts updating...</p>
        )}
      </CardContent>
    </Card>
  )
}

function PlaytimeLeaderboard({
  players,
  emptyMessage,
  showTotalMinutes = false,
  chatMessagesByPlayer,
  chatPeriod,
}: {
  players: PlaytimePlayer[]
  emptyMessage: string
  showTotalMinutes?: boolean
  chatMessagesByPlayer?: Record<string, number>
  chatPeriod: 'in the last 7 days' | 'total'
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
                  <span className="block text-xs text-muted-foreground">
                    {chatMessagesByPlayer
                      ? `${(chatMessagesByPlayer[player.name.toLowerCase()] ?? 0).toLocaleString()} chat messages ${chatPeriod}`
                      : 'Chat message counts updating...'}
                  </span>
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

export function PlaytimeStats({
  weeklyChatMessages,
  lifetimeChatMessages,
}: {
  weeklyChatMessages?: Record<string, number>
  lifetimeChatMessages?: Record<string, number>
}) {
  const [stats, setStats] = useState<PlaytimeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const totalWeeklyChatMessages = weeklyChatMessages
    ? Object.values(weeklyChatMessages).reduce((total, count) => total + count, 0)
    : undefined

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
              {(stats.weekly ?? []).length > 0 ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {stats.weekly?.map((player, index) => (
                    <WeeklyPlaytimeCard
                      key={player.name}
                      player={{
                        ...player,
                        chatMessages: weeklyChatMessages?.[player.name.toLowerCase()],
                      }}
                      rank={index + 1}
                      totalWeeklyChatMessages={totalWeeklyChatMessages}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">
                      No player playtime has been recorded in the available period.
                    </p>
                  </CardContent>
                </Card>
              )}
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
                chatMessagesByPlayer={lifetimeChatMessages}
                chatPeriod="total"
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
