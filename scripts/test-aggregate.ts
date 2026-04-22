import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import { aggregateNightlyCategories } from '../lib/analytics/aggregate'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))
sqlite.pragma('journal_mode = WAL')
const db = drizzle(sqlite)

const deviceIps = JSON.parse(
  (sqlite.prepare("SELECT value FROM settings WHERE key = 'pihole_device_ips'").get() as { value: string } | undefined)?.value ?? '[]'
) as string[]

console.log('Device IPs:', deviceIps)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const results = aggregateNightlyCategories(db as any, deviceIps, 3)

console.log(`\nNights with sleep sessions + computed aggregates: ${results.length}`)

const withQueries = results.filter((r) => r.totalQueries > 0)
console.log(`Nights with any pre-sleep queries: ${withQueries.length}`)

if (withQueries.length > 0) {
  console.log('\nMost recent nights with query data:')
  for (const r of withQueries.slice(-5)) {
    console.log(
      `  ${r.date} · sleep@${new Date(r.sleepStartTs * 1000).toISOString().slice(11, 16)} UTC · ${r.totalQueries} queries`
    )
    for (const [cat, count] of Object.entries(r.byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${count.toString().padStart(4)}  ${cat}`)
    }
  }
}
