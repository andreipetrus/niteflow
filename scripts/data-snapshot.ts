import Database from 'better-sqlite3'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'), { readonly: true })

function count(sql: string): number {
  return (sqlite.prepare(sql).get() as { c: number }).c
}

console.log('=== Data Snapshot ===')
console.log(`sleep_sessions: ${count('SELECT COUNT(*) as c FROM sleep_sessions')}`)
console.log(`sleep_records:  ${count('SELECT COUNT(*) as c FROM sleep_records')}`)
console.log(`pihole_queries: ${count('SELECT COUNT(*) as c FROM pihole_queries')}`)
console.log(
  `  categorized: ${count('SELECT COUNT(*) as c FROM pihole_queries WHERE category IS NOT NULL')}`
)
console.log(`domain_categories: ${count('SELECT COUNT(*) as c FROM domain_categories')}`)

const sleepRange = sqlite
  .prepare('SELECT MIN(date) as min, MAX(date) as max FROM sleep_sessions')
  .get() as { min: string; max: string } | undefined
if (sleepRange)
  console.log(`\nSleep sessions date range: ${sleepRange.min} → ${sleepRange.max}`)

const piholeRange = sqlite
  .prepare('SELECT MIN(timestamp) as min, MAX(timestamp) as max FROM pihole_queries')
  .get() as { min: number; max: number }
if (piholeRange.min) {
  console.log(
    `Pi-hole queries date range: ${new Date(piholeRange.min * 1000).toISOString()} → ${new Date(piholeRange.max * 1000).toISOString()}`
  )
}

// Overlap nights: where do sleep_sessions and pihole_queries both have data?
const overlap = sqlite
  .prepare(
    `SELECT s.date, s.quality_score, s.total_min, s.hrv_avg
     FROM sleep_sessions s
     WHERE EXISTS (
       SELECT 1 FROM pihole_queries q
       WHERE date(q.timestamp, 'unixepoch') = s.date
    )
    ORDER BY s.date DESC LIMIT 14`
  )
  .all()
console.log(`\nOverlap nights (sleep + queries same date): ${overlap.length}`)
for (const n of overlap) console.log(' ', n)
