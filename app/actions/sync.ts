'use server'

import { getPiholeConfig, getSetting, setSetting } from '@/lib/db/queries/settings'
import { fetchDevices } from '@/lib/pihole/devices'
import { syncQueries } from '@/lib/pihole/sync'
import { db } from '@/lib/db/client'

export type DevicesResult =
  | { ok: true; devices: { ip: string; name: string }[] }
  | { ok: false; error: string }

export async function loadDevices(): Promise<DevicesResult> {
  const config = getPiholeConfig()
  if (!config) return { ok: false, error: 'Pi-hole not configured' }

  try {
    const devices = await fetchDevices(config)
    return { ok: true, devices }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function saveDevices(ips: string[]): Promise<void> {
  setSetting('pihole_device_ips', JSON.stringify(ips))
}

export async function getSelectedDeviceIps(): Promise<string[]> {
  const raw = getSetting('pihole_device_ips')
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export type SyncActionResult =
  | { ok: true; inserted: number; skipped: number }
  | { ok: false; error: string }

export async function runPiholeSync(days = 30): Promise<SyncActionResult> {
  const config = getPiholeConfig()
  if (!config) return { ok: false, error: 'Pi-hole not configured' }

  const selectedIps = await getSelectedDeviceIps()
  if (selectedIps.length === 0) return { ok: false, error: 'No devices selected' }

  const to = Math.floor(Date.now() / 1000)
  const from = to - days * 86400

  try {
    const result = await syncQueries(db, config, selectedIps, from, to)
    setSetting('pihole_last_sync', String(Date.now()))
    return { ok: true, inserted: result.inserted, skipped: result.skipped }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
