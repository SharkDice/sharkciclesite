'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Pickaxe, MessageSquare, Trophy } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface BlockCount {
  material: string
  count: number
}

interface PlayerStats {
  name: string
  totalBroken: number
  blocks: BlockCount[]
  otherCount: number
}

interface BuilderStats {
  name: string
  totalPlaced: number
  blocks: BlockCount[]
  otherCount: number
}

interface StatsData {
  success: boolean
  period?: string
  timestamp?: string
  data?: {
    totalBlocksBroken: number
    totalBlocksPlaced: number
    totalChatMessages: number
    topBlocks: number
    players: PlayerStats[]
    builders: BuilderStats[]
  }
  error?: string
}

// "deepslate_iron_ore" -> "Deepslate Iron Ore"
function formatMaterial(material: string) {
  return material
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const RANK_STYLES = [
  'bg-yellow-400 text-yellow-950', // 1st
  'bg-gray-300 text-gray-800', // 2nd
  'bg-amber-600 text-amber-50', // 3rd
]

function PlayerCard({ player, rank }: { player: PlayerStats; rank: number }) {
  const rankStyle = RANK_STYLES[rank - 1] ?? 'bg-muted text-muted-foreground'

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://minotar.net/avatar/${encodeURIComponent(player.name)}/48`}
              alt=""
              width={48}
              height={48}
              className="rounded-md"
              loading="lazy"
              onError={(e) => {
                // If the first skin service is down, fall back to a second one (once)
                const img = e.currentTarget
                if (!img.dataset.fallback) {
                  img.dataset.fallback = '1'
                  img.src = `https://mc-heads.net/avatar/${encodeURIComponent(player.name)}/48`
                }
              }}
            />
            <span
              className={`absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow ${rankStyle}`}
            >
              {rank}
            </span>
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{player.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{player.totalBroken.toLocaleString()}</span> blocks broken
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {player.blocks.map((block) => {
            const pct = Math.max(2, (block.count / player.totalBroken) * 100)
            return (
              <div key={block.material} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate pr-2">{formatMaterial(block.material)}</span>
                  <span className="shrink-0 font-medium tabular-nums">{block.count.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}

        {player.otherCount > 0 && (
          <p className="border-t pt-2 text-xs text-muted-foreground">
            + {player.otherCount.toLocaleString()} other blocks
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function BuilderCard({ builder, rank }: { builder: BuilderStats; rank: number }) {
  const rankStyle = RANK_STYLES[rank - 1] ?? 'bg-muted text-muted-foreground'

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://minotar.net/avatar/${encodeURIComponent(builder.name)}/48`}
              alt=""
              width={48}
              height={48}
              className="rounded-md"
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget
                if (!img.dataset.fallback) {
                  img.dataset.fallback = '1'
                  img.src = `https://mc-heads.net/avatar/${encodeURIComponent(builder.name)}/48`
                }
              }}
            />
            <span
              className={`absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow ${rankStyle}`}
            >
              {rank}
            </span>
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{builder.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{builder.totalPlaced.toLocaleString()}</span> blocks placed
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {builder.blocks.map((block) => {
            const pct = Math.max(2, (block.count / builder.totalPlaced) * 100)
            return (
              <div key={block.material} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate pr-2">{formatMaterial(block.material)}</span>
                  <span className="shrink-0 font-medium tabular-nums">{block.count.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}

        {builder.otherCount > 0 && (
          <p className="border-t pt-2 text-xs text-muted-foreground">
            + {builder.otherCount.toLocaleString()} other blocks
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function CoreProtectStats() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/coreprotect-stats')
      const data: StatsData = await response.json()

      if (!data.success) {
        setError(data.error || 'Failed to fetch statistics')
      } else {
        setStats(data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const players = stats?.data?.players ?? []
  const builders = stats?.data?.builders ?? []
  const topBlocks = stats?.data?.topBlocks ?? 3

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Server Statistics</h1>
          <p className="text-gray-500 mt-1">Last 7 days activity</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}. Make sure the CoreProtect API service is running on your Debian machine.
          </AlertDescription>
        </Alert>
      )}

      {lastUpdated && (
        <p className="text-sm text-gray-500">Last updated: {lastUpdated.toLocaleTimeString()}</p>
      )}

      {stats?.data ? (
        <>
          {/* Server totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocks Broken</CardTitle>
                <Pickaxe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.data.totalBlocksBroken.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">By players in the last 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocks Placed</CardTitle>
                <Pickaxe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.data.totalBlocksPlaced?.toLocaleString() ?? 0}</div>
                <p className="text-xs text-muted-foreground">By players in the last 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chat Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.data.totalChatMessages.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Messages sent in the last 7 days</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-player breakdown */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-semibold">Top Miners</h2>
              <span className="text-sm text-muted-foreground">
                (top {players.length} players, their {topBlocks} most-broken blocks)
              </span>
            </div>

            {players.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {players.map((player, i) => (
                  <PlayerCard key={player.name} player={player} rank={i + 1} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-gray-500">No blocks have been broken in the last 7 days.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Per-builder breakdown */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-green-500" />
              <h2 className="text-xl font-semibold">Top Builders</h2>
              <span className="text-sm text-muted-foreground">
                (top {stats.data.builders?.length ?? 0} builders, their {topBlocks} most-placed blocks)
              </span>
            </div>

            {stats.data.builders && stats.data.builders.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {stats.data.builders.map((builder, i) => (
                  <BuilderCard key={builder.name} builder={builder} rank={i + 1} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-gray-500">No blocks have been placed in the last 7 days.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <p>Loading statistics...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-gray-500">No data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
