import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import { sleepSessions } from '../lib/db/schema'
import type { HealthRecord } from '../lib/health/parser'
import {
  groupIntoNights,
  computeSleepSession,
  computeHrvBaseline,
  scoreNight,
} from '../lib/health/scoring'

async function main() {
  const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))
  sqlite.pragma('journal_mode = WAL')
  const db = drizzle(sqlite)

  const rows = sqlite
    .prepare('SELECT type, start_ts as startTs, end_ts as endTs, value, unit, source FROM sleep_records')
    .all() as HealthRecord[]

  console.log(`Loaded ${rows.length.toLocaleString()} raw records`)

  const nights = groupIntoNights(rows)
  const hrvBaseline = computeHrvBaseline(rows)
  const allHrv = rows.filter(
    (r) => r.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
  )

  sqlite.prepare('DELETE FROM sleep_sessions').run()

  db.transaction((tx) => {
    for (const n of nights) {
      const s = computeSleepSession(n, allHrv)
      const qualityScore = scoreNight(s, hrvBaseline)
      tx.insert(sleepSessions)
        .values({
          date: s.date,
          sleepStartTs: s.sleepStartTs,
          sleepEndTs: s.sleepEndTs,
          qualityScore,
          totalMin: s.totalMin,
          deepPct: s.deepPct,
          remPct: s.remPct,
          hrvAvg: s.hrvAvg,
          efficiency: s.efficiency,
        })
        .onConflictDoUpdate({
          target: sleepSessions.date,
          set: {
            sleepStartTs: s.sleepStartTs,
            sleepEndTs: s.sleepEndTs,
            qualityScore,
            totalMin: s.totalMin,
            deepPct: s.deepPct,
            remPct: s.remPct,
            hrvAvg: s.hrvAvg,
            efficiency: s.efficiency,
          },
        })
        .run()
    }
  })

  const range = sqlite
    .prepare('SELECT COUNT(*) as c, MIN(date) as min, MAX(date) as max, AVG(quality_score) as avg, AVG(total_min) as avgMin FROM sleep_sessions')
    .get() as { c: number; min: string; max: string; avg: number; avgMin: number }
  console.log(`\nsleep_sessions: ${range.c} nights, ${range.min} → ${range.max}`)
  console.log(`Avg quality: ${range.avg.toFixed(1)} · avg duration: ${range.avgMin.toFixed(0)}min`)
}

main().catch(console.error)
