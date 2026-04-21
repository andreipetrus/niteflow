import { z } from 'zod'

const AuthResponseSchema = z.object({
  session: z.object({
    valid: z.boolean(),
    sid: z.string(),
    validity: z.number(),
    csrf: z.string().optional(),
  }),
})

export type PiholeSession = {
  sid: string
  expiresAt: number // Unix seconds
}

export function isTokenExpired(expiresAt: number): boolean {
  // Treat token as expired 60s before actual expiry to avoid races
  return Date.now() / 1000 > expiresAt - 60
}

export async function acquireToken(
  baseUrl: string,
  password: string,
  allowInsecure: boolean
): Promise<PiholeSession> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/auth`

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }

  // Node 18+ supports dispatcher for self-signed certs; handled at call site
  if (allowInsecure && typeof process !== 'undefined') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  const res = await fetch(url, fetchOptions)

  if (!res.ok) {
    throw new Error(`Pi-hole auth failed with status ${res.status}`)
  }

  const data = AuthResponseSchema.parse(await res.json())

  if (!data.session.valid) {
    throw new Error('Invalid Pi-hole credentials')
  }

  return {
    sid: data.session.sid,
    expiresAt: Math.floor(Date.now() / 1000) + data.session.validity,
  }
}
