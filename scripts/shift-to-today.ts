/**
 * TEST-ONLY: additive shift so the LATEST sleep_session lands on today.
 * Run after shift-health-data.ts if the initial shift under-shot because
 * of a tail period with no sleep stage data.
 */
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

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))
sqlite.pragma('journal_mode = WAL')
const db = drizzle(sqlite)

async function main() {
  // Find latest session's actual end timestamp by checking records on that date
  const latestSession = sqlite
    .prepare('SELECT date FROM sleep_sessions ORDER BY date DESC LIMIT 1')
    .get() as { date: string } | undefined

  if (!latestSession) {
    console.error('No sleep_sessions found.')
    process.exit(1)
  }

  // Use end of that date in UTC as the reference
  const latestDateEndTs =
    Math.floor(new Date(latestSession.date + 'T23:59:59Z').getTime() / 1000)
  const todayEndTs = Math.floor(
    new Date(new Date().toISOString().slice(0, 10) + 'T23:59:59Z').getTime() / 1000
  )
  const shift = todayEndTs - latestDateEndTs

  console.log(`Latest session date: ${latestSession.date}`)
  console.log(`Shifting by additional ${(shift / 86400).toFixed(1)} days`)

  if (shift <= 0) {
    console.log('No additional shift needed.')
    return
  }

  sqlite
    .prepare('UPDATE sleep_records SET start_ts = start_ts + ?, end_ts = end_ts + ?')
    .run(shift, shift)

  sqlite.prepare('DELETE FROM sleep_sessions').run()

  const rows = sqlite
    .prepare(
      'SELECT type, start_ts as startTs, end_ts as endTs, value, unit, source FROM sleep_records'
    )
    .all() as HealthRecord[]

  const nights = groupIntoNights(rows)
  const hrvBaseline = computeHrvBaseline(rows)
  const allHrv = rows.filter(
    (r) => r.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
  )

  db.transaction((tx) => {
    for (const n of nights) {
      const s = computeSleepSession(n, allHrv)
      const qualityScore = scoreNight(s, hrvBaseline)
      tx.insert(sleepSessions)
        .values({
          date: s.date,
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

  const newRange = sqlite
    .prepare('SELECT MIN(date) as min, MAX(date) as max, COUNT(*) as c FROM sleep_sessions')
    .get() as { min: string; max: string; c: number }
  console.log(`sleep_sessions: ${newRange.c} rows, ${newRange.min} → ${newRange.max}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
