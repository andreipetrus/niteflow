import { db } from '../client'
import { settings } from '../schema'
import { eq } from 'drizzle-orm'

export function getSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get()
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run()
}

export function deleteSetting(key: string): void {
  db.delete(settings).where(eq(settings.key, key)).run()
}

export type PiholeConfig = {
  url: string
  password: string
  allowInsecure: boolean
}

export function getPiholeConfig(): PiholeConfig | null {
  const url = getSetting('pihole_url')
  const password = getSetting('pihole_password')
  if (!url || !password) return null
  return {
    url,
    password,
    allowInsecure: getSetting('pihole_tls_insecure') === 'true',
  }
}
