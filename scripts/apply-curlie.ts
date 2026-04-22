/**
 * Runs the Curlie taxonomy apply flow directly against the app DB.
 * Mirrors app/actions/taxonomy.ts::applyCurlieTaxonomy.
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, isNotNull, sql } from 'drizzle-orm'
import path from 'path'
import fs from 'fs'
import { domainCategories, piholeQueries } from '../lib/db/schema'
import { categorizeDomain } from '../lib/taxonomy/categorize'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))
sqlite.pragma('journal_mode = WAL')
const db = drizzle(sqlite)

const raw = fs.readFileSync(path.join(process.cwd(), 'data/curlie-taxonomy.json'), 'utf-8')
const taxonomy = JSON.parse(raw) as Record<string, string>
const entries = Object.entries(taxonomy)
const now = Math.floor(Date.now() / 1000)
const source = 'curlie'

const started = Date.now()
console.log(`Applying ${entries.length.toLocaleString()} domains…`)

db.transaction((tx) => {
  tx.delete(domainCategories).where(eq(domainCategories.source, source)).run()

  let i = 0
  for (const [domain, category] of entries) {
    const existing = tx
      .select({ source: domainCategories.source })
      .from(domainCategories)
      .where(eq(domainCategories.domain, domain))
      .get()
    if (existing?.source === 'user') continue

    tx.insert(domainCategories)
      .values({ domain, category, source, updatedAt: now })
      .onConflictDoUpdate({
        target: domainCategories.domain,
        set: { category, source, updatedAt: now },
      })
      .run()

    i++
    if (i % 50000 === 0) console.log(`  inserted ${i.toLocaleString()}…`)
  }
})

console.log(`Inserted in ${((Date.now() - started) / 1000).toFixed(1)}s`)

console.log('Re-categorizing existing pihole_queries with subdomain fallback…')
const recatStart = Date.now()

const distinctDomains = sqlite
  .prepare('SELECT DISTINCT domain FROM pihole_queries')
  .all() as { domain: string }[]

db.transaction((tx) => {
  for (const { domain } of distinctDomains) {
    const category = categorizeDomain(domain, taxonomy)
    if (category) {
      tx.run(sql`UPDATE pihole_queries SET category = ${category} WHERE domain = ${domain}`)
    }
  }
})

console.log(`Re-categorized ${distinctDomains.length.toLocaleString()} distinct domains in ${((Date.now() - recatStart) / 1000).toFixed(1)}s`)

const total = (sqlite.prepare('SELECT COUNT(*) as c FROM pihole_queries').get() as { c: number }).c
const categorized = (sqlite
  .prepare('SELECT COUNT(*) as c FROM pihole_queries WHERE category IS NOT NULL')
  .get() as { c: number }).c

console.log(`\n${categorized.toLocaleString()} / ${total.toLocaleString()} queries categorized (${((categorized / total) * 100).toFixed(1)}%)`)

const dist = sqlite
  .prepare(
    `SELECT category, COUNT(*) as c FROM pihole_queries
     WHERE category IS NOT NULL
     GROUP BY category ORDER BY c DESC`
  )
  .all() as { category: string; c: number }[]

console.log('\nCategory distribution:')
for (const d of dist) console.log(`  ${d.c.toString().padStart(6)}  ${d.category}`)
