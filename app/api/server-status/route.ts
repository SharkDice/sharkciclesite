import { NextRequest, NextResponse } from 'next/server'
import { status } from 'minecraft-server-util'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const SERVER_HOST = 'play.sharkcicle.com'
  const SERVER_PORT = 25565

  try {
    // Query the Minecraft server directly using the protocol
    const serverStatus = await status(SERVER_HOST, SERVER_PORT, { timeout: 10000 })

    // Extract MOTD - use the clean version without formatting codes
    let motd = 'Welcome to Sharkcicle SMP!'
    if (serverStatus.motd?.clean) {
      // Get first line of clean MOTD
      motd = serverStatus.motd.clean.split('\n')[0].trim() || 'Welcome to Sharkcicle SMP!'
    }

    // Extract version number - get the last part after the dash
    let version = 'Unknown'
    if (serverStatus.version?.name) {
      // Extract version like "26.1.2" from "Velocity 1.7.2-26.1.2"
      const versionMatch = serverStatus.version.name.match(/(\d+\.\d+\.\d+)$/)
      if (versionMatch) {
        version = `Minecraft ${versionMatch[1]}`
      } else {
        version = serverStatus.version.name
      }
    }

    // Format the response
    const response = {
      online: true,
      players: {
        online: serverStatus.players?.online || 0,
        max: serverStatus.players?.max || 0,
      },
      motd: motd,
      version: version,
      favicon: serverStatus.favicon || null,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  } catch (error) {
    console.error('Server status query error:', error)
    
    // Return offline status when query fails
    return NextResponse.json({
      online: false,
      players: { online: 0, max: 0 },
      motd: 'Server is offline or unreachable',
      version: '',
      error: 'Unable to connect to server',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  }
}
