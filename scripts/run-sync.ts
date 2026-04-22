/**
 * Standalone sync runner — invokes the app's syncQueries against the real
 * SQLite DB using credentials stored by the settings UI.
 *
 * Run: npx tsx scripts/run-sync.ts
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import { syncQueries } from '../lib/pihole/sync'
import * as schema from '../lib/db/schema'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))
sqlite.pragma('journal_mode = WAL')
const db = drizzle(sqlite, { schema })

function getSetting(key: string): string | null {
  const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

const url = (getSetting('pihole_url') ?? '').replace(/\/$/, '')
const password = getSetting('pihole_password')
const allowInsecure = getSetting('pihole_tls_insecure') === 'true'
const deviceIpsRaw = getSetting('pihole_device_ips')

if (!url || !password) {
  console.error('Missing Pi-hole credentials. Configure /settings first.')
  process.exit(1)
}

const deviceIps: string[] = deviceIpsRaw ? JSON.parse(deviceIpsRaw) : []
if (deviceIps.length === 0) {
  console.error('No devices selected. Select at least one at /settings.')
  process.exit(1)
}

const to = Math.floor(Date.now() / 1000)
const from = to - 30 * 86400

console.log(`Syncing ${deviceIps.length} device(s): ${deviceIps.join(', ')}`)
console.log(`Date range: ${new Date(from * 1000).toISOString()} → ${new Date(to * 1000).toISOString()}`)

const startTime = Date.now()

syncQueries(db, { url, password, allowInsecure }, deviceIps, from, to)
  .then((result) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n✓ Sync complete in ${elapsed}s`)
    console.log(`  Inserted: ${result.inserted}`)
    console.log(`  Skipped:  ${result.skipped}`)

    const total = sqlite.prepare('SELECT COUNT(*) as c FROM pihole_queries').get() as { c: number }
    console.log(`  Total rows in DB: ${total.c}`)
  })
  .catch((err) => {
    console.error('\n✗ Sync failed:', err.message)
    if (err.stack) console.error(err.stack)
    process.exit(1)
  })
