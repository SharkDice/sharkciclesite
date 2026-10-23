import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0 // Disable all caching

export async function GET(request: NextRequest) {
  try {
    const DEBIAN_SERVICE_URL = 'http://play.sharkcicle.com:3001'

    // Forward the player/block/limit/offset/sort query params straight through
    const incoming = request.nextUrl.searchParams
    const qs = new URLSearchParams()
    for (const key of ['player', 'block', 'limit', 'offset', 'sort']) {
      const value = incoming.get(key)
      if (value) qs.set(key, value)
    }

    const response = await fetch(`${DEBIAN_SERVICE_URL}/lookup?${qs.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Set a timeout so we don't hang forever
      signal: AbortSignal.timeout(5000), // 5 second timeout
      cache: 'no-store', // Disable fetch caching
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, {
        status: response.status,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        }
      })
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  } catch (error) {
    console.error('Block lookup API error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch lookup results',
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  }
}
