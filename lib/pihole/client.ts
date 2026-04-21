import { acquireToken, isTokenExpired } from './auth'
import type { PiholeSession } from './auth'

export type PiholeClientConfig = {
  url: string
  password: string
  allowInsecure: boolean
}

// In-process session cache (server process lifetime)
let cachedSession: PiholeSession | null = null

async function getSession(config: PiholeClientConfig): Promise<PiholeSession> {
  if (cachedSession && !isTokenExpired(cachedSession.expiresAt)) {
    return cachedSession
  }
  cachedSession = await acquireToken(config.url, config.password, config.allowInsecure)
  return cachedSession
}

export function clearSessionCache() {
  cachedSession = null
}

export async function piholeGet<T>(
  config: PiholeClientConfig,
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  const session = await getSession(config)
  const requestUrl = new URL(`${config.url.replace(/\/$/, '')}${path}`)

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      requestUrl.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(requestUrl.toString(), {
    headers: {
      sid: session.sid,
      'Content-Type': 'application/json',
    },
  })

  if (res.status === 401) {
    // Session expired — clear cache and retry once
    cachedSession = null
    const freshSession = await getSession(config)
    const retryRes = await fetch(requestUrl.toString(), {
      headers: { sid: freshSession.sid, 'Content-Type': 'application/json' },
    })
    if (!retryRes.ok) throw new Error(`Pi-hole API error: ${retryRes.status} on ${path}`)
    return retryRes.json() as Promise<T>
  }

  if (!res.ok) throw new Error(`Pi-hole API error: ${res.status} on ${path}`)
  return res.json() as Promise<T>
}
