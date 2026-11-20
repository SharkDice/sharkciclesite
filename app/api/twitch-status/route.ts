import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TWITCH_LOGIN = 'SharkyDice'
const STATUS_CACHE_DURATION = 60_000
const TOKEN_EXPIRY_BUFFER = 60_000

interface TwitchTokenResponse {
  access_token: string
  expires_in: number
}

interface TwitchStreamsResponse {
  data: Array<{ id: string }>
}

let cachedToken: { value: string; expiresAt: number } | null = null
let tokenRequest: Promise<string> | null = null
let cachedStreamStatus: { isLive: boolean; checkedAt: number } | null = null
let streamStatusRequest: Promise<boolean> | null = null

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER) {
    return cachedToken.value
  }

  if (!tokenRequest) {
    tokenRequest = (async () => {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }),
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Twitch token request failed with status ${response.status}`)
      }

      const token: TwitchTokenResponse = await response.json()
      if (!token.access_token || !Number.isFinite(token.expires_in)) {
        throw new Error('Twitch token response was invalid')
      }

      cachedToken = {
        value: token.access_token,
        expiresAt: Date.now() + token.expires_in * 1000,
      }
      return token.access_token
    })()
  }

  try {
    return await tokenRequest
  } finally {
    tokenRequest = null
  }
}

async function getStreamStatus(clientId: string, clientSecret: string): Promise<boolean> {
  if (cachedStreamStatus && Date.now() - cachedStreamStatus.checkedAt < STATUS_CACHE_DURATION) {
    return cachedStreamStatus.isLive
  }

  if (!streamStatusRequest) {
    streamStatusRequest = (async () => {
      const accessToken = await getAccessToken(clientId, clientSecret)
      const response = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${TWITCH_LOGIN}`,
        {
          headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error(`Twitch stream status request failed with status ${response.status}`)
      }

      const streams: TwitchStreamsResponse = await response.json()
      if (!Array.isArray(streams.data)) {
        throw new Error('Twitch stream status response was invalid')
      }

      const isLive = streams.data.length > 0
      cachedStreamStatus = { isLive, checkedAt: Date.now() }
      return isLive
    })()
  }

  try {
    return await streamStatusRequest
  } finally {
    streamStatusRequest = null
  }
}

export async function GET() {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { configured: false, live: false },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const live = await getStreamStatus(clientId, clientSecret)
    return NextResponse.json(
      { configured: true, live },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Twitch stream status API error:', error)
    return NextResponse.json(
      { error: 'Unable to check Twitch stream status' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
