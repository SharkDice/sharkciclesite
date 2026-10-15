'use client'

import { useEffect, useState } from 'react'
import { Activity, Users, AlertCircle } from 'lucide-react'

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
      try {
        const response = await fetch('https://api.mcsrvstat.us/v3/status/java/play.sharkcicle.com', {
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
          setStatus({
            online: false,
            players: { online: 0, max: 0 },
            motd: 'Server is currently offline',
            version: '',
            loading: false,
            error: null,
          })
        }
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to fetch server status',
        }))
      }
    }

    fetchServerStatus()
    const interval = setInterval(fetchServerStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted || status.loading) {
    return (
      <div className="bg-[#2C2F33] rounded-lg p-6 text-center">
        <div className="animate-pulse">
          <p className="text-gray-400">Loading server status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg p-6 ${status.online ? 'bg-[#2C2F33]' : 'bg-red-900 bg-opacity-20'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold">Server Status</h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${status.online ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className={`font-semibold ${status.online ? 'text-green-400' : 'text-red-400'}`}>
            {status.online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {status.error && (
        <div className="flex items-center gap-2 text-yellow-400 mb-4">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm">{status.error}</p>
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

            <div className="pt-2">
              <p className="text-sm text-gray-400 mb-1">MOTD</p>
              <p className="text-white italic">{status.motd}</p>
            </div>

            {status.version && (
              <div>
                <p className="text-sm text-gray-400">Version</p>
                <p className="text-white">{status.version}</p>
              </div>
            )}
          </div>
        </>
      )}

      {!status.online && (
        <div className="text-center text-red-300">
          <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="mb-2">{status.motd}</p>
          <p className="text-sm text-red-400">Please check back soon!</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-600 text-xs text-gray-400">
        <p>Server: play.sharkcicle.com</p>
      </div>
    </div>
  )
}
