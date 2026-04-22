/**
 * TEST-ONLY: shifts every sleep_record timestamp forward so the latest end
 * lands on "today", then rebuilds sleep_sessions from the shifted records.
 * Used to create overlap with Pi-hole's recent-only data for correlation
 * testing.
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import { sleepRecords, sleepSessions } from '../lib/db/schema'
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
  const { minTs, maxTs } = sqlite
    .prepare('SELECT MIN(start_ts) as minTs, MAX(end_ts) as maxTs FROM sleep_records')
    .get() as { minTs: number; maxTs: number }

  if (!minTs || !maxTs) {
    console.error('No sleep_records found — nothing to shift.')
    process.exit(1)
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const shift = nowSec - maxTs

  const fmt = (ts: number) => new Date(ts * 1000).toISOString()
  console.log(`Before: ${fmt(minTs)} → ${fmt(maxTs)}`)
  console.log(`Shift: ${shift}s (${(shift / 86400).toFixed(1)} days)`)
  console.log(`After:  ${fmt(minTs + shift)} → ${fmt(maxTs + shift)}`)

  // 1. Shift raw record timestamps
  const shiftStart = Date.now()
  sqlite
    .prepare('UPDATE sleep_records SET start_ts = start_ts + ?, end_ts = end_ts + ?')
    .run(shift, shift)
  console.log(`Shifted sleep_records in ${Date.now() - shiftStart}ms`)

  // 2. Wipe sleep_sessions (including the 2024-01-16/17 fixture pollution) —
  //    recomputation below repopulates with correct, aligned dates.
  sqlite.prepare('DELETE FROM sleep_sessions').run()

  // 3. Recompute sessions from the shifted records
  console.log('Loading shifted records into memory for scoring…')
  const rows = sqlite
    .prepare('SELECT type, start_ts as startTs, end_ts as endTs, value, unit, source FROM sleep_records')
    .all() as HealthRecord[]
  console.log(`Loaded ${rows.length.toLocaleString()} records`)

  const nights = groupIntoNights(rows)
  const hrvBaseline = computeHrvBaseline(rows)
  const allHrv = rows.filter(
    (r) => r.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
  )

  const sessions = nights.map((n) => {
    const s = computeSleepSession(n, allHrv)
    return { ...s, qualityScore: scoreNight(s, hrvBaseline) }
  })

  db.transaction((tx) => {
    for (const s of sessions) {
      tx.insert(sleepSessions)
        .values({
          date: s.date,
          qualityScore: s.qualityScore,
          totalMin: s.totalMin,
          deepPct: s.deepPct,
          remPct: s.remPct,
          hrvAvg: s.hrvAvg,
          efficiency: s.efficiency,
        })
        .onConflictDoUpdate({
          target: sleepSessions.date,
          set: {
            qualityScore: s.qualityScore,
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
  console.log(`\nsleep_sessions now: ${newRange.c} rows, ${newRange.min} → ${newRange.max}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
