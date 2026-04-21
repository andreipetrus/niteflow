'use server'

import { z } from 'zod'
import { getSetting, setSetting, getPiholeConfig } from '@/lib/db/queries/settings'
import { clearSessionCache, piholeGet } from '@/lib/pihole/client'

const PiholeSettingsSchema = z.object({
  url: z.string().url('Must be a valid URL (e.g. http://192.168.1.1)'),
  password: z.string().min(1, 'Password is required'),
  allowInsecure: z.boolean().optional().default(false),
})

export type SettingsFormState = {
  success?: boolean
  error?: string
}

export async function savePiholeSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = PiholeSettingsSchema.safeParse({
    url: formData.get('url'),
    password: formData.get('password'),
    allowInsecure: formData.get('allowInsecure') === 'on',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { url, password, allowInsecure } = parsed.data
  setSetting('pihole_url', url)
  setSetting('pihole_password', password)
  setSetting('pihole_tls_insecure', String(allowInsecure))
  clearSessionCache()

  return { success: true }
}

const PiholeInfoSchema = z.object({
  version: z.object({ web: z.string().optional(), api: z.string().optional() }).optional(),
  ftldb: z.object({ version: z.number().optional() }).optional(),
})

export type ConnectionTestResult =
  | { ok: true; version: string }
  | { ok: false; error: string }

export async function testPiholeConnection(): Promise<ConnectionTestResult> {
  const config = getPiholeConfig()
  if (!config) return { ok: false, error: 'No Pi-hole settings configured' }

  try {
    const info = await piholeGet<unknown>(config, '/api/info/version')
    const parsed = PiholeInfoSchema.safeParse(info)
    const version = parsed.success
      ? (parsed.data.version?.web ?? parsed.data.version?.api ?? 'v6')
      : 'v6'
    return { ok: true, version }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function loadPiholeSettings() {
  return {
    url: getSetting('pihole_url') ?? '',
    allowInsecure: getSetting('pihole_tls_insecure') === 'true',
  }
}
