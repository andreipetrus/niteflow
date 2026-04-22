/**
 * End-to-end test: load Curlie taxonomy into the SQLite DB and report
 * what percentage of synced queries end up categorized.
 */
import Database from 'better-sqlite3'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'), { readonly: true })

function count(sql: string, ...args: unknown[]): number {
  return (sqlite.prepare(sql).get(...args) as { c: number }).c
}

console.log('=== BEFORE Apply ===')
console.log(`domain_categories rows: ${count('SELECT COUNT(*) as c FROM domain_categories').toLocaleString()}`)
console.log(`pihole_queries total: ${count('SELECT COUNT(*) as c FROM pihole_queries').toLocaleString()}`)
console.log(`pihole_queries categorized: ${count('SELECT COUNT(*) as c FROM pihole_queries WHERE category IS NOT NULL').toLocaleString()}`)

// Sample top uncategorized domains to show what's being missed
const uncategorized = sqlite
  .prepare(
    `SELECT domain, COUNT(*) as c FROM pihole_queries
     WHERE category IS NULL
       AND domain NOT LIKE '%.arpa'
       AND domain NOT LIKE '%.local'
       AND domain NOT LIKE '%_dns-sd%'
       AND domain NOT LIKE '%._udp.%'
       AND domain NOT LIKE '%._tcp.%'
     GROUP BY domain ORDER BY c DESC LIMIT 15`
  )
  .all() as { domain: string; c: number }[]

console.log('\nTop 15 uncategorized (non-noise) domains:')
for (const row of uncategorized) {
  console.log(`  ${row.c.toString().padStart(5)}  ${row.domain}`)
}
