import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const serverAddress = '170.52.103.140'
  const serverPort = '25565'
  
  try {
    // Try multiple API services since proxy setups can be unreliable
    const apis = [
      `https://api.mcsrvstat.us/v3/status/java/${serverAddress}:${serverPort}`,
      `https://api.mcsrvstat.us/v3/status/java/${serverAddress}`,
    ]

    let data = null
    let lastError = null

    for (const url of apis) {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000)
        })
        
        if (response.ok) {
          data = await response.json()
          break
        }
      } catch (error) {
        lastError = error
        continue
      }
    }

    // If we got data, return it
    if (data) {
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        }
      })
    }

    // Return offline status with debug info
    return NextResponse.json({
      online: false,
      players: { online: 0, max: 0 },
      error: 'Unable to reach server status API. Server may be offline or unreachable.',
      motd: 'Unable to fetch status'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  } catch (error) {
    console.error('Server status error:', error)
    return NextResponse.json({
      online: false,
      players: { online: 0, max: 0 },
      error: 'Failed to fetch server status',
      motd: 'Connection error'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  }
}
