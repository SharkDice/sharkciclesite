'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, BarChart3, Blocks, Clock3, MessageSquare, Pickaxe, RefreshCw, Search, Skull, Trophy, Users, type LucideIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BlockIcon, BlockLookup } from '@/components/block-lookup'

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

interface MobKillCount {
  mob: string
  count: number
}

interface MobPlayerStats {
  name: string
  totalKills: number
  mobs: MobKillCount[]
}

interface LifetimeMobStats {
  mob: string
  kills: number
}

interface StatsData {
  success: boolean
  period?: string
  timestamp?: string
  data?: {
    totalBlocksBroken: number
    totalBlocksPlaced: number
    totalMobKills: number
    totalMobKillsAllTime: number | null
    mobKillsRollupReady: boolean
    lifetimeMobTypesReady: boolean
    lifetimeTopMobs: LifetimeMobStats[]
    totalChatMessages: number
    topBlocks: number
    topMobs: number
    mobPlayersReady: boolean
    players: PlayerStats[]
    builders: BuilderStats[]
    mobPlayers: MobPlayerStats[]
  }
  error?: string
}

interface LifetimeBlockRow {
  block: string
  broken: number
  placed: number
}

interface LifetimeLookupResponse {
  success: boolean
  hasMore: boolean
  rows: LifetimeBlockRow[]
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

function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="mb-4 rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function MobPlayerCard({ player, rank }: { player: MobPlayerStats; rank: number }) {
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
              <span className="font-semibold text-foreground">{player.totalKills.toLocaleString()}</span> mobs killed
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {player.mobs.map((mob) => {
          const pct = Math.max(2, (mob.count / player.totalKills) * 100)
          return (
            <div key={mob.mob} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="truncate pr-2">{formatMaterial(mob.mob)}</span>
                <span className="shrink-0 font-medium tabular-nums">{mob.count.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-red-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function StatsUnavailable({ loading }: { loading: boolean }) {
  return (
    <Card>
      <CardContent className="py-12">
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <p>Loading statistics...</p>
          </div>
        ) : (
          <p className="text-center text-muted-foreground">No data available.</p>
        )}
      </CardContent>
    </Card>
  )
}

function LifetimeBlockStats({ action }: { action: 'broken' | 'placed' }) {
  const isBroken = action === 'broken'
  const metricLabel = isBroken ? 'Broken' : 'Placed'
  const MetricIcon = isBroken ? Pickaxe : Blocks
  const barColor = isBroken ? 'bg-blue-500' : 'bg-green-500'
  const [total, setTotal] = useState<number | null>(null)
  const [topBlocks, setTopBlocks] = useState<LifetimeBlockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const fetchLifetimeStats = async () => {
      try {
        const allBlocks: LifetimeBlockRow[] = []
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const query = new URLSearchParams({
            limit: '500',
            offset: String(offset),
            sort: action,
          })
          const response = await fetch(`/api/block-lookup?${query}`, { signal: controller.signal })
          const data: LifetimeLookupResponse = await response.json()

          if (!response.ok || !data.success) {
            throw new Error(data.error || `Failed to load lifetime blocks ${action}`)
          }
          if (!Array.isArray(data.rows) || typeof data.hasMore !== 'boolean') {
            throw new Error(`The lifetime blocks ${action} response was invalid`)
          }
          if (data.rows.length === 0 && data.hasMore) {
            throw new Error(`The lifetime blocks ${action} response returned an empty page`)
          }

          allBlocks.push(...data.rows)
          offset += data.rows.length
          hasMore = data.hasMore
        }

        if (!controller.signal.aborted) {
          setTotal(allBlocks.reduce((sum, block) => sum + block[action], 0))
          setTopBlocks(allBlocks.slice(0, 25))
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : `Failed to load lifetime blocks ${action}`)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchLifetimeStats()
    return () => controller.abort()
  }, [action])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-12">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <p>Loading lifetime block statistics...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Blocks {metricLabel}</CardTitle>
          <MetricIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(total ?? 0).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Lifetime total across all tracked blocks</p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h2 className="text-xl font-semibold">Top 25 Blocks {metricLabel}</h2>
        </div>
        {topBlocks.length > 0 ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              {topBlocks.map((block, index) => {
                const count = block[action]
                const maxCount = topBlocks[0][action]
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0

                return (
                  <div key={block.block} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                        <BlockIcon material={block.block} />
                        <span className="truncate">{formatMaterial(block.block)}</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.max(2, percentage)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">No lifetime block {isBroken ? 'break' : 'placement'} data is available.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
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
          <p className="mt-1 text-muted-foreground">Explore server activity by category and time period.</p>
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

      <Tabs defaultValue="broken" className="space-y-6">
        <div>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border bg-card p-1">
            <TabsTrigger value="broken" className="h-10 gap-2 px-3">
              <Pickaxe className="h-4 w-4" />
              Blocks Broken
            </TabsTrigger>
            <TabsTrigger value="placed" className="h-10 gap-2 px-3">
              <Blocks className="h-4 w-4" />
              Blocks Placed
            </TabsTrigger>
            <TabsTrigger value="mobs" className="h-10 gap-2 px-3">
              <Skull className="h-4 w-4" />
              Mob Kills
            </TabsTrigger>
            <TabsTrigger value="time" className="h-10 gap-2 px-3">
              <Clock3 className="h-4 w-4" />
              Time Played
            </TabsTrigger>
            <TabsTrigger value="community" className="h-10 gap-2 px-3">
              <Users className="h-4 w-4" />
              Community Stats
            </TabsTrigger>
            <TabsTrigger value="other" className="h-10 gap-2 px-3">
              <BarChart3 className="h-4 w-4" />
              Other Stats
            </TabsTrigger>
            <TabsTrigger value="lookup" className="h-10 gap-2 px-3">
              <Search className="h-4 w-4" />
              Block Lookup
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="broken" className="space-y-6">
          <Tabs defaultValue="seven-days" className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl border bg-card p-1">
              <TabsTrigger value="seven-days">Last 7 days</TabsTrigger>
              <TabsTrigger value="lifetime">Lifetime</TabsTrigger>
            </TabsList>
            <TabsContent value="seven-days" className="space-y-6">
              {stats?.data ? (
                <>
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

                  <section className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <h2 className="text-xl font-semibold">Top Miners</h2>
                      <span className="text-sm text-muted-foreground">
                        (top {players.length} players, their {topBlocks} most-broken blocks)
                      </span>
                    </div>
                    {players.length > 0 ? (
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        {players.map((player, i) => (
                          <PlayerCard key={player.name} player={player} rank={i + 1} />
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-12">
                          <p className="text-center text-muted-foreground">No blocks have been broken in the last 7 days.</p>
                        </CardContent>
                      </Card>
                    )}
                  </section>
                </>
              ) : (
                <StatsUnavailable loading={loading} />
              )}
            </TabsContent>
            <TabsContent value="lifetime">
              <LifetimeBlockStats action="broken" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="placed" className="space-y-6">
          <Tabs defaultValue="seven-days" className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl border bg-card p-1">
              <TabsTrigger value="seven-days">Last 7 days</TabsTrigger>
              <TabsTrigger value="lifetime">Lifetime</TabsTrigger>
            </TabsList>
            <TabsContent value="seven-days" className="space-y-6">
              {stats?.data ? (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Blocks Placed</CardTitle>
                      <Blocks className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.data.totalBlocksPlaced?.toLocaleString() ?? 0}</div>
                      <p className="text-xs text-muted-foreground">By players in the last 7 days</p>
                    </CardContent>
                  </Card>

                  <section className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Trophy className="h-5 w-5 text-green-500" />
                      <h2 className="text-xl font-semibold">Top Builders</h2>
                      <span className="text-sm text-muted-foreground">
                        (top {builders.length} builders, their {topBlocks} most-placed blocks)
                      </span>
                    </div>
                    {builders.length > 0 ? (
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        {builders.map((builder, i) => (
                          <BuilderCard key={builder.name} builder={builder} rank={i + 1} />
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-12">
                          <p className="text-center text-muted-foreground">No blocks have been placed in the last 7 days.</p>
                        </CardContent>
                      </Card>
                    )}
                  </section>
                </>
              ) : (
                <StatsUnavailable loading={loading} />
              )}
            </TabsContent>
            <TabsContent value="lifetime">
              <LifetimeBlockStats action="placed" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="mobs">
          <Tabs defaultValue="seven-days" className="space-y-6">
            <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl border bg-card p-1">
              <TabsTrigger value="seven-days">Last 7 days</TabsTrigger>
              <TabsTrigger value="lifetime">Lifetime</TabsTrigger>
            </TabsList>
            <TabsContent value="seven-days" className="space-y-6">
              {stats?.data ? (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Mob Kills</CardTitle>
                      <Skull className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.data.totalMobKills.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">Non-player entities killed by players in the last 7 days</p>
                    </CardContent>
                  </Card>

                  <section className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      <h2 className="text-xl font-semibold">Top Mob Hunters</h2>
                      <span className="text-sm text-muted-foreground">
                        (top {stats.data.mobPlayers.length} players, their {stats.data.topMobs} most-killed mobs)
                      </span>
                    </div>
                    {!stats.data.mobPlayersReady ? (
                      <Card>
                        <CardContent className="py-12">
                          <p className="text-center text-muted-foreground">
                            Player rankings will appear after the statistics service finishes its next refresh.
                          </p>
                        </CardContent>
                      </Card>
                    ) : stats.data.mobPlayers.length > 0 ? (
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        {stats.data.mobPlayers.map((player, index) => (
                          <MobPlayerCard key={player.name} player={player} rank={index + 1} />
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-12">
                          <p className="text-center text-muted-foreground">No player mob kills have been recorded in the last 7 days.</p>
                        </CardContent>
                      </Card>
                    )}
                  </section>
                </>
              ) : (
                <StatsUnavailable loading={loading} />
              )}
            </TabsContent>
            <TabsContent value="lifetime">
              {stats?.data?.mobKillsRollupReady &&
              stats.data.lifetimeMobTypesReady &&
              stats.data.totalMobKillsAllTime !== null ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Lifetime Mob Kills</CardTitle>
                      <Skull className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.data.totalMobKillsAllTime.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">Non-player entities killed by players in the configured worlds</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top 25 Mobs Killed</CardTitle>
                      <p className="text-sm text-muted-foreground">Lifetime kills by mob type</p>
                    </CardHeader>
                    <CardContent>
                      {stats.data.lifetimeTopMobs.length > 0 ? (
                        <ol className="space-y-3">
                          {stats.data.lifetimeTopMobs.map((mob, index) => (
                            <li key={mob.mob} className="flex items-center gap-3">
                              <span className="w-7 shrink-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
                                {index + 1}.
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm">{formatMaterial(mob.mob)}</span>
                              <span className="shrink-0 font-semibold tabular-nums">{mob.kills.toLocaleString()}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-muted-foreground">No mob kills are recorded in the available CoreProtect history.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">
                      The historical mob-kill totals and rankings are being built from CoreProtect. They will appear here when the initial rollup completes.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="time">
          <ComingSoon
            icon={Clock3}
            title="Play time stats are coming soon"
            description="See time played by individual players and across the server here in a future update."
          />
        </TabsContent>

        <TabsContent value="community">
          {stats?.data ? (
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
          ) : (
            <StatsUnavailable loading={loading} />
          )}
        </TabsContent>

        <TabsContent value="other">
          <ComingSoon
            icon={BarChart3}
            title="More stats are coming soon"
            description="Additional server statistics will be organized here as they become available."
          />
        </TabsContent>

        <TabsContent value="lookup">
          <BlockLookup />
        </TabsContent>
      </Tabs>
    </div>
  )
}
