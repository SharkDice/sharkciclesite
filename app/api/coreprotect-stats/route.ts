import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0 // Disable all caching

export async function GET(request: NextRequest) {
  try {
    // Fetch from Debian service (which has cached data)
    const DEBIAN_SERVICE_URL = 'http://play.sharkcicle.com:3001'
    
    const response = await fetch(`${DEBIAN_SERVICE_URL}/stats`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Set a timeout so we don't hang forever
      signal: AbortSignal.timeout(5000), // 5 second timeout
      cache: 'no-store', // Disable fetch caching
    })

    if (!response.ok) {
      throw new Error(`Debian service returned status ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  } catch (error) {
    console.error('Statistics API error:', error)
    
    // Return error response
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch statistics',
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  }
}
