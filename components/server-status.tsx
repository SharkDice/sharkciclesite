'use client'

import { useEffect, useState } from 'react'
import { Activity, Users, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ServerStatus {
  online: boolean
  players: {
    online: number
    max: number
  }
  motd: string
  version: string
  loading: boolean
  error: string | null
}

export function ServerStatus() {
  const [status, setStatus] = useState<ServerStatus>({
    online: false,
    players: { online: 0, max: 0 },
    motd: '',
    version: '',
    loading: true,
    error: null,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const fetchServerStatus = async () => {
      setStatus((prev) => ({ ...prev, loading: true }))
      try {
        const response = await fetch('/api/server-status', {
          cache: 'no-store',
        })
        const data = await response.json()

        if (data.online) {
          setStatus({
            online: true,
            players: {
              online: data.players?.online || 0,
              max: data.players?.max || 0,
            },
            motd: data.motd?.clean?.[0] || 'Welcome to Sharkcicle SMP!',
            version: data.version || 'Unknown',
            loading: false,
            error: null,
          })
        } else {
          setStatus((prev) => ({
            ...prev,
            online: false,
            players: { online: 0, max: 0 },
            motd: data.motd || 'Server status unavailable',
            version: '',
            loading: false,
            error: data.error ? null : null,
          }))
        }
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          online: false,
          error: 'Unable to fetch server status',
        }))
      }
    }

    fetchServerStatus()
    const interval = setInterval(fetchServerStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setStatus((prev) => ({ ...prev, loading: true }))
    try {
      const response = await fetch('/api/server-status', {
        cache: 'no-store',
      })
      const data = await response.json()

      if (data.online) {
        setStatus({
          online: true,
          players: {
            online: data.players?.online || 0,
            max: data.players?.max || 0,
          },
          motd: data.motd?.clean?.[0] || 'Welcome to Sharkcicle SMP!',
          version: data.version || 'Unknown',
          loading: false,
          error: null,
        })
      } else {
        setStatus((prev) => ({
          ...prev,
          online: false,
          players: { online: 0, max: 0 },
          motd: data.motd || 'Server status unavailable',
          version: '',
          loading: false,
          error: null,
        }))
      }
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: 'Unable to fetch server status',
      }))
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className={`rounded-lg p-6 ${status.online ? 'bg-[#2C2F33]' : 'bg-red-900 bg-opacity-20 border border-red-700'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold">Server Status</h3>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRefresh}
            disabled={status.loading}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${status.loading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${status.online ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className={`font-semibold text-sm ${status.online ? 'text-green-400' : 'text-red-400'}`}>
              {status.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {status.error && (
        <div className="flex items-center gap-2 text-yellow-400 mb-4 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{status.error}</p>
        </div>
      )}

      {status.online && (
        <>
          <div className="space-y-3 text-gray-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                <span>Players Online</span>
              </div>
              <span className="font-semibold text-white">
                {status.players.online}/{status.players.max}
              </span>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(status.players.online / status.players.max) * 100 || 0}%`,
                }}
              />
            </div>

            {status.motd && (
              <div className="pt-2">
                <p className="text-sm text-gray-400 mb-1">MOTD</p>
                <p className="text-white italic text-sm">{status.motd}</p>
              </div>
            )}

            {status.version && (
              <div>
                <p className="text-sm text-gray-400">Version</p>
                <p className="text-white text-sm">{status.version}</p>
              </div>
            )}
          </div>
        </>
      )}

      {!status.online && !status.loading && (
        <div className="text-center text-red-300">
          <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="mb-2 text-sm font-medium">{status.motd}</p>
          <p className="text-xs text-red-400">Join our Discord to check server status!</p>
        </div>
      )}

      {status.loading && (
        <div className="text-center text-gray-400">
          <div className="inline-block">
            <div className="animate-spin">
              <RefreshCw className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-2 text-sm">Checking server status...</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-600 text-xs text-gray-400">
        <p>Server: play.sharkcicle.com:25565</p>
      </div>
    </div>
  )
}
