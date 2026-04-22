/**
 * End-to-end smoke test of the Apple Health import pipeline against
 * the tiny sample-export.xml fixture. Runs against the real DB.
 */
import fs from 'fs'
import path from 'path'
import { importHealthXml } from '../lib/health/import'

import Database from 'better-sqlite3'

async function main() {
  const fixturePath = path.join(process.cwd(), 'lib/health/__fixtures__/sample-export.xml')
  const stream = fs.createReadStream(fixturePath)

  const summary = await importHealthXml(stream)

  console.log('\n=== Import Summary ===')
  console.log(`Records parsed:  ${summary.recordsParsed}`)
  console.log(`Nights computed: ${summary.nightsComputed}`)
  console.log(`Date range:      ${summary.dateRange?.from} → ${summary.dateRange?.to}`)
  console.log(`Elapsed:         ${summary.elapsedMs}ms`)

  const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'), { readonly: true })
  const sessions = sqlite.prepare('SELECT * FROM sleep_sessions ORDER BY date').all()
  console.log('\n=== Sessions in DB ===')
  for (const s of sessions) console.log(s)

  const recordCount = (sqlite.prepare('SELECT COUNT(*) as c FROM sleep_records').get() as { c: number }).c
  console.log(`\nsleep_records rows: ${recordCount}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
