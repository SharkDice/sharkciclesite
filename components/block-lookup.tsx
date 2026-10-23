'use client'

import { useEffect, useState } from 'react'
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

function formatMaterial(material: string) {
  return material
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
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
    if (!player.trim() && !block.trim()) {
      setError('Enter a player name and/or a block to search.')
      return
    }
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
          Lifetime blocks broken and placed. Search by player, by block, or both.
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Player</th>
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
                    <td className="py-2 pr-4">{formatMaterial(r.block)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.broken.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums">{r.placed.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
