import Database from 'better-sqlite3'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'), { readonly: true })

const total = (sqlite.prepare('SELECT COUNT(*) as c FROM pihole_queries').get() as { c: number }).c
const dateRange = sqlite
  .prepare('SELECT MIN(timestamp) as min_ts, MAX(timestamp) as max_ts FROM pihole_queries')
  .get() as { min_ts: number; max_ts: number }

const topDomains = sqlite
  .prepare(
    'SELECT domain, COUNT(*) as c FROM pihole_queries GROUP BY domain ORDER BY c DESC LIMIT 10'
  )
  .all() as { domain: string; c: number }[]

const statuses = sqlite
  .prepare('SELECT status, COUNT(*) as c FROM pihole_queries GROUP BY status ORDER BY c DESC')
  .all() as { status: string; c: number }[]

console.log(`Total queries: ${total}`)
console.log(
  `Date range: ${new Date(dateRange.min_ts * 1000).toISOString()} → ${new Date(dateRange.max_ts * 1000).toISOString()}`
)
console.log('\nTop 10 domains:')
for (const d of topDomains) console.log(`  ${d.c.toString().padStart(6)}  ${d.domain}`)
console.log('\nStatus distribution:')
for (const s of statuses) console.log(`  ${s.c.toString().padStart(6)}  ${s.status}`)
