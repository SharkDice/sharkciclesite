'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowLeft,
  AlertCircle,
  Blocks,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pickaxe,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LookupRow {
  player: string
  block?: string
  broken: number
  placed: number
  blockTypes?: number
}

const PAGE_SIZE = 100
const MC_ASSETS_VERSION = '1.21.1'
const MC_ASSETS_BASE = `https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@${MC_ASSETS_VERSION}/assets/minecraft/textures`

// Liquids are stored as a tall vertical filmstrip of animation frames, not a single
// square texture - rendered separately below by cropping to just the first frame.
const LIQUID_TEXTURES: Record<string, string> = {
  water: 'water_still',
  flowing_water: 'water_still',
  lava: 'lava_still',
  flowing_lava: 'lava_still',
}

// Hand-verified fixes for materials whose CoreProtect/vanilla id doesn't match any
// single texture filename (e.g. multi-face blocks, renamed blocks, crop growth stages).
const ICON_ALIASES: Record<string, string> = {
  grass_block: 'grass_block_top',
  podzol: 'podzol_top',
  mycelium: 'mycelium_top',
  quartz_block: 'quartz_block_top',
  tnt: 'tnt_top',
  scaffolding: 'scaffolding_top',
  grass: 'short_grass',
  potatoes: 'potatoes_stage3',
  carrots: 'carrots_stage3',
  beetroots: 'beetroots_stage3',
  wheat: 'wheat_stage7',
  nether_wart: 'nether_wart_stage2',
  redstone_wire: 'redstone_dust_dot',
  smooth_sandstone: 'sandstone_top',
  smooth_quartz: 'quartz_block_bottom',
}

// Generic rules for structural variants that reuse another block's texture
// (wood "all bark" variants, carpets, slabs/stairs/walls/etc.). Each candidate is
// attempted in order until one resolves to a real texture.
function suffixCandidates(material: string): string[] {
  const out: string[] = []
  if (material.endsWith('_wood')) out.push(material.replace(/_wood$/, '_log'))
  if (material.endsWith('_carpet')) out.push(material.replace(/_carpet$/, '_wool'))

  const shapeMatch = material.match(
    /^(.*)_(slab|stairs|wall|fence_gate|fence|pressure_plate|button|door|trapdoor)$/
  )
  if (shapeMatch) {
    const base = shapeMatch[1]
    out.push(`${base}_planks`, base, `${base}s`)
  }
  return out
}

function blockTextureCandidates(material: string): string[] {
  const candidates = [ICON_ALIASES[material] ?? material, ...suffixCandidates(material), material]
  return Array.from(new Set(candidates))
}

function formatMaterial(material: string) {
  return material
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function PlayerSkinAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [name])

  if (name.trim().toUpperCase() === 'TNT') {
    return <BlockIcon material="tnt" size={size} />
  }

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
      className="shrink-0 rounded border bg-muted"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

export function BlockIcon({ material, size = 20 }: { material: string; size?: number }) {
  const liquid = LIQUID_TEXTURES[material]
  const candidates = useMemo(() => blockTextureCandidates(material), [material])
  // 0..candidates.length-1 tries each block-texture candidate, candidates.length
  // tries the item-texture folder, anything past that means give up and hide.
  const [stage, setStage] = useState(0)

  useEffect(() => setStage(0), [material])

  if (liquid) {
    // Crop the animated filmstrip texture down to just its first frame via a
    // scaled background image, instead of a plain <img>.
    return (
      <span
        aria-hidden="true"
        className="inline-block shrink-0"
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${MC_ASSETS_BASE}/block/${liquid}.png)`,
          backgroundSize: '100% auto',
          backgroundPosition: 'top',
          imageRendering: 'pixelated',
        }}
      />
    )
  }

  if (stage > candidates.length) return null

  const src =
    stage < candidates.length
      ? `${MC_ASSETS_BASE}/block/${candidates[stage]}.png`
      : `${MC_ASSETS_BASE}/item/${material}.png`

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="inline-block shrink-0"
      style={{ imageRendering: 'pixelated' }}
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
    />
  )
}

type SortOption = 'total' | 'broken' | 'placed'

const SORT_LABELS: Record<SortOption, string> = {
  total: 'Total activity',
  broken: 'Most broken',
  placed: 'Most placed',
}

export function BlockLookup() {
  const [players, setPlayers] = useState<string[]>([])
  const [materials, setMaterials] = useState<string[]>([])
  const [player, setPlayer] = useState('')
  const [block, setBlock] = useState('')
  const [focusedPlayer, setFocusedPlayer] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('total')
  const [rows, setRows] = useState<LookupRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadOptions = async () => {
      try {
        const response = await fetch('/api/block-lookup/options', { signal: controller.signal })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Could not load player and block suggestions')
        }
        if (!Array.isArray(data.players) || !Array.isArray(data.materials)) {
          throw new Error('The player and block suggestions response was invalid')
        }

        setPlayers(data.players)
        setMaterials(data.materials)
      } catch (err) {
        if (!controller.signal.aborted) {
          setOptionsError(err instanceof Error ? err.message : 'Could not load search suggestions')
        }
      }
    }

    loadOptions()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    requestController.current = controller
    const queryPlayer = player.trim()
    const queryBlock = block.trim()
    const playerView = focusedPlayer === null

    setLoading(true)
    setError(null)
    setRows([])
    setHasMore(false)
    setHasSearched(false)

    const timeout = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: '0',
          sort,
          view: playerView ? 'players' : 'blocks',
        })
        if (focusedPlayer) qs.set('playerExact', focusedPlayer)
        else if (queryPlayer) qs.set('player', queryPlayer)
        if (queryBlock) qs.set('block', queryBlock)

        const response = await fetch(`/api/block-lookup?${qs.toString()}`, {
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Could not load block lookup results')
        }
        if (!Array.isArray(data.rows) || typeof data.hasMore !== 'boolean') {
          throw new Error('The block lookup returned an invalid response')
        }
        if (data.rows.some((row: LookupRow) =>
          typeof row.player !== 'string' ||
          typeof row.broken !== 'number' ||
          typeof row.placed !== 'number' ||
          (playerView ? typeof row.blockTypes !== 'number' : typeof row.block !== 'string')
        )) {
          throw new Error('The block lookup returned invalid player or block records')
        }

        setRows(data.rows)
        setHasMore(data.hasMore)
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Could not load block lookup results')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setHasSearched(true)
        }
      }
    }, queryPlayer || queryBlock ? 300 : 0)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [player, block, focusedPlayer, sort, retryKey])

  const inputClass =
    'h-12 w-full rounded-xl border border-border bg-background pl-11 pr-10 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border shadow-md">
        <CardContent className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="lookup-player" className="mb-2 block text-sm font-semibold">
                Player name
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="lookup-player"
                  className={inputClass}
                  list="lookup-players"
                  placeholder="Filter by user"
                  value={player}
                  onChange={(event) => {
                    setFocusedPlayer(null)
                    setPlayer(event.target.value)
                  }}
                  autoComplete="off"
                />
                {player && (
                  <button
                    type="button"
                    aria-label="Clear player filter"
                    onClick={() => {
                      setFocusedPlayer(null)
                      setPlayer('')
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <datalist id="lookup-players">
                  {players.map((name) => <option key={name} value={name} />)}
                </datalist>
              </div>
            </div>

            <div>
              <label htmlFor="lookup-block" className="mb-2 block text-sm font-semibold">
                Block type
              </label>
              <div className="relative">
                <Blocks className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="lookup-block"
                  className={inputClass}
                  list="lookup-materials"
                  placeholder="Filter by block"
                  value={block}
                  onChange={(event) => setBlock(event.target.value)}
                  autoComplete="off"
                />
                {block && (
                  <button
                    type="button"
                    aria-label="Clear block filter"
                    onClick={() => setBlock('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <datalist id="lookup-materials">
                  {materials.map((material) => (
                    <option key={material} value={material} label={formatMaterial(material)} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-1 rounded-xl border bg-muted/50 p-1">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => {
                const selected = sort === key
                const Icon = key === 'broken' ? Pickaxe : key === 'placed' ? Blocks : ChevronDown
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSort(key)}
                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition sm:px-5 ${
                      selected
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {key === 'total' ? 'Total' : key === 'broken' ? 'Broken' : 'Placed'}
                  </button>
                )
              })}
            </div>
          </div>

          {optionsError && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Suggestions could not be loaded. You can still search by typing.
            </p>
          )}

          {focusedPlayer && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-blue-500/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <PlayerSkinAvatar name={focusedPlayer} size={40} />
                <div>
                  <p className="text-xs text-muted-foreground">Viewing player</p>
                  <p className="text-[0.95rem] font-bold">{focusedPlayer}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFocusedPlayer(null)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-background px-4 text-xs font-semibold hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setRetryKey((key) => key + 1)}
                  className="rounded-lg border border-destructive/30 px-4 py-2 text-xs font-semibold hover:bg-destructive/10"
                >
                  Try again
                </button>
              </AlertDescription>
            </Alert>
          )}

          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Loading player activity...
            </div>
          ) : hasSearched && rows.length === 0 && !error ? (
            <div className="rounded-2xl border border-dashed py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-[1.0625rem] font-bold">No matching players</h3>
              <p className="mx-auto mt-2 max-w-lg px-4 text-sm leading-6 text-muted-foreground">
                Try a shorter part of the player&apos;s name or clear the block filter.
              </p>
            </div>
          ) : rows.length > 0 ? (
            <div className="space-y-3" aria-live="polite">
              {!focusedPlayer && (
                <div className="hidden grid-cols-[minmax(0,1fr)_minmax(140px,0.55fr)_minmax(140px,0.55fr)_24px] gap-4 px-5 text-xs font-semibold text-muted-foreground sm:grid">
                  <span>Player</span>
                  <span className="text-right">Blocks broken</span>
                  <span className="text-right">Blocks placed</span>
                  <span />
                </div>
              )}
              {rows.map((row, index) => focusedPlayer ? (
                <div
                  key={`${row.player}-${row.block}`}
                  className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.55fr)_minmax(150px,0.55fr)] sm:items-center sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <BlockIcon material={row.block ?? ''} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-[0.95rem] font-bold">{formatMaterial(row.block ?? '')}</p>
                      <p className="text-xs text-muted-foreground">Block type</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <span className="text-xs text-muted-foreground sm:hidden">Blocks broken</span>
                    <span className="text-[1.0625rem] font-bold tabular-nums text-blue-500">
                      {row.broken.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <span className="text-xs text-muted-foreground sm:hidden">Blocks placed</span>
                    <span className="text-[1.0625rem] font-bold tabular-nums text-green-500">
                      {row.placed.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  key={row.player}
                  type="button"
                  onClick={() => setFocusedPlayer(row.player)}
                  className="grid w-full gap-4 rounded-2xl border bg-card p-4 text-left transition hover:border-blue-500/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 sm:grid-cols-[minmax(0,1fr)_minmax(140px,0.55fr)_minmax(140px,0.55fr)_24px] sm:items-center sm:px-5"
                >
                  <span className="flex min-w-0 items-center gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <PlayerSkinAvatar name={row.player} size={48} />
                    <span className="min-w-0">
                      <span className="block truncate text-[1.0625rem] font-bold">{row.player}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {row.blockTypes?.toLocaleString()} block types · View block details
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center justify-between sm:block sm:text-right">
                    <span className="text-xs text-muted-foreground sm:hidden">Blocks broken</span>
                    <span className="text-[1.0625rem] font-bold tabular-nums text-blue-500">
                      {row.broken.toLocaleString()}
                    </span>
                  </span>
                  <span className="flex items-center justify-between sm:block sm:text-right">
                    <span className="text-xs text-muted-foreground sm:hidden">Blocks placed</span>
                    <span className="text-[1.0625rem] font-bold tabular-nums text-green-500">
                      {row.placed.toLocaleString()}
                    </span>
                  </span>
                  <ChevronRight className="hidden h-5 w-5 text-muted-foreground sm:block" />
                </button>
              ))}
            </div>
          ) : null}

          {hasMore && (
            <div className="border-t pt-5 text-center">
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true)
                  setError(null)
                  const controller = requestController.current
                  try {
                    const qs = new URLSearchParams({
                      limit: String(PAGE_SIZE),
                      offset: String(rows.length),
                      sort,
                      view: focusedPlayer ? 'blocks' : 'players',
                    })
                    if (focusedPlayer) qs.set('playerExact', focusedPlayer)
                    else if (player.trim()) qs.set('player', player.trim())
                    if (block.trim()) qs.set('block', block.trim())
                    const response = await fetch(`/api/block-lookup?${qs.toString()}`, {
                      signal: controller?.signal,
                    })
                    const data = await response.json()
                    if (!response.ok || !data.success || !Array.isArray(data.rows) || typeof data.hasMore !== 'boolean') {
                      throw new Error(data.error || 'Could not load more results')
                    }
                    setRows((currentRows) => [...currentRows, ...data.rows])
                    setHasMore(data.hasMore)
                  } catch (err) {
                    if (!controller?.signal.aborted) {
                      setError(err instanceof Error ? err.message : 'Could not load more results')
                    }
                  } finally {
                    if (!controller?.signal.aborted) setLoading(false)
                  }
                }}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border bg-background px-6 text-sm font-semibold shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ChevronDown className="h-5 w-5" />}
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
