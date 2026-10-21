'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Pickaxe, MessageSquare, Users } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface StatsData {
  success: boolean
  period?: string
  timestamp?: string
  cachedAt?: string
  data?: {
    totalBlocksBroken: number
    totalChatMessages: number
    uniquePlayers: number
  }
  error?: string
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
    // Fetch immediately on mount
    fetchStats()

    // Set up interval to refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000)

    return () => clearInterval(interval)
  }, [])

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
        <p className="text-sm text-gray-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
          {stats?.cachedAt && ` (Cached at ${stats.cachedAt})`}
        </p>
      )}

      {stats?.data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Blocks Broken Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocks Broken</CardTitle>
              <Pickaxe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.data.totalBlocksBroken.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Total in the last 7 days
              </p>
            </CardContent>
          </Card>

          {/* Chat Messages Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chat Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.data.totalChatMessages.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Messages sent in the last 7 days
              </p>
            </CardContent>
          </Card>

          {/* Active Players Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Players</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.data.uniquePlayers}
              </div>
              <p className="text-xs text-muted-foreground">
                Unique players in the last 7 days
              </p>
            </CardContent>
          </Card>
        </div>
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
