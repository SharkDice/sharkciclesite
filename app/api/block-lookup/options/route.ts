import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0 // Disable all caching

export async function GET(request: NextRequest) {
  try {
    const DEBIAN_SERVICE_URL = 'http://play.sharkcicle.com:3001'

    // Fetch the player list and material list in parallel
    const [playersRes, materialsRes] = await Promise.all([
      fetch(`${DEBIAN_SERVICE_URL}/players`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      }),
      fetch(`${DEBIAN_SERVICE_URL}/materials`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      }),
    ])

    if (!playersRes.ok || !materialsRes.ok) {
      throw new Error('Debian service returned an error fetching options')
    }

    const playersData = await playersRes.json()
    const materialsData = await materialsRes.json()

    return NextResponse.json({
      success: true,
      players: playersData.players ?? [],
      materials: materialsData.materials ?? [],
    }, {
      headers: {
        // These lists change rarely, a short cache is fine
        'Cache-Control': 'public, max-age=300',
      }
    })
  } catch (error) {
    console.error('Block lookup options API error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch lookup options',
      players: [],
      materials: [],
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  }
}
