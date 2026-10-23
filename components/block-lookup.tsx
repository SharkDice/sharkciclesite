'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LookupRow {
  player: string
  block: string
  broken: number
  placed: number
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

function BlockIcon({ material }: { material: string }) {
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
          width: 20,
          height: 20,
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
      width={20}
      height={20}
      className="inline-block shrink-0"
      style={{ imageRendering: 'pixelated' }}
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
    />
  )
}

type SortOption = 'total' | 'broken' | 'placed'

const SORT_LABELS: Record<SortOption, string> = {
  total: 'Total (broken + placed)',
  broken: 'Most broken',
  placed: 'Most placed',
}

export function BlockLookup() {
  const [players, setPlayers] = useState<string[]>([])
  const [materials, setMaterials] = useState<string[]>([])
  const [player, setPlayer] = useState('')
  const [block, setBlock] = useState('')
  const [sort, setSort] = useState<SortOption>('total')
  const [rows, setRows] = useState<LookupRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [overview, setOverview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/block-lookup/options')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPlayers(d.players)
          setMaterials(d.materials)
        }
      })
      .catch(() => {})
  }, [])

  const search = async (append = false) => {
    const isOverview = !player.trim() && !block.trim()
    try {
      setLoading(true)
      setError(null)
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(append ? rows.length : 0),
        sort,
      })
      if (player.trim()) qs.set('player', player.trim())
      if (block.trim()) qs.set('block', block.trim())

      const res = await fetch(`/api/block-lookup?${qs.toString()}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Lookup failed')

      setRows(append ? [...rows, ...data.rows] : data.rows)
      setHasMore(data.hasMore)
      setSearched(true)
      setOverview(isOverview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Block Lookup</CardTitle>
        <p className="text-sm text-muted-foreground">
          Lifetime blocks broken and placed. Search by player, by block, or both -
          leave both blank to see the top blocks overall.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            search(false)
          }}
        >
          <input
            className={inputClass}
            list="lookup-players"
            placeholder="Player name"
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
          />
          <datalist id="lookup-players">
            {players.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          <input
            className={inputClass}
            list="lookup-materials"
            placeholder="Block (e.g. diamond_ore)"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
          />
          <datalist id="lookup-materials">
            {materials.map((m) => (
              <option key={m} value={m} label={formatMaterial(m)} />
            ))}
          </datalist>

          <select
            className={inputClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            aria-label="Sort by"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {searched && rows.length === 0 && !error && (
          <p className="py-6 text-center text-gray-500">No results found.</p>
        )}

        {rows.length > 0 && (
          <div className="space-y-2">
            {overview && (
              <p className="text-sm text-muted-foreground">
                Top blocks overall by {SORT_LABELS[sort].toLowerCase()} - player shown is the top contributor.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">#</th>
                    <th className="py-2 pr-4 font-medium">{overview ? 'Top player' : 'Player'}</th>
                    <th className="py-2 pr-4 font-medium">Block</th>
                    <th className="py-2 pr-4 text-right font-medium">Broken</th>
                    <th className="py-2 text-right font-medium">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.player}-${r.block}`} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="py-2 pr-4">{r.player}</td>
                      <td className="py-2 pr-4">
                        <span className="flex items-center gap-2">
                          <BlockIcon material={r.block} />
                          {formatMaterial(r.block)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.broken.toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums">{r.placed.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => search(true)}
            disabled={loading}
            className="w-full rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
