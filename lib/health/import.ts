import { Readable } from 'stream'
import { parseHealthXml, type HealthRecord } from './parser'
import {
  groupIntoNights,
  computeSleepSession,
  computeHrvBaseline,
  scoreNight,
} from './scoring'
import { db } from '@/lib/db/client'
import { sleepRecords, sleepSessions } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export type ImportSummary = {
  recordsParsed: number
  nightsComputed: number
  elapsedMs: number
  dateRange: { from: string; to: string } | null
}

/**
 * Streams an Apple Health `export.xml`, persists raw records, groups into
 * nightly sleep sessions, and writes composite quality scores to
 * sleep_sessions. Idempotent: sleep_records is wiped first and
 * sleep_sessions uses upsert-by-date.
 */
export async function importHealthXml(xmlStream: Readable): Promise<ImportSummary> {
  const started = Date.now()

  // Collect records in memory. For a 1–2GB export, the ~1M relevant
  // records amount to ~200MB in-memory (typed objects) — tolerable for a
  // desktop user. If this ever becomes a problem we can persist incrementally.
  const allRecords: HealthRecord[] = []
  for await (const rec of parseHealthXml(xmlStream)) {
    allRecords.push(rec)
  }

  if (allRecords.length === 0) {
    return {
      recordsParsed: 0,
      nightsComputed: 0,
      elapsedMs: Date.now() - started,
      dateRange: null,
    }
  }

  // Persist raw records (wipe + bulk insert in one transaction)
  db.transaction((tx) => {
    tx.delete(sleepRecords).run()
    // Batch inserts by 500 for SQLite bind-variable limits
    const batchSize = 500
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize).map((r) => ({
        type: r.type,
        startTs: r.startTs,
        endTs: r.endTs,
        value: r.value,
        unit: r.unit,
        source: r.source,
      }))
      tx.insert(sleepRecords).values(batch).run()
    }
  })

  // Compute sessions + scores
  const nights = groupIntoNights(allRecords)
  const hrvBaseline = computeHrvBaseline(allRecords)
  const allHrv = allRecords.filter(
    (r) => r.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN'
  )

  const sessions = nights.map((night) => {
    const s = computeSleepSession(night, allHrv)
    const qualityScore = scoreNight(s, hrvBaseline)
    return { ...s, qualityScore }
  })

  // Upsert one row per night
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

  const minDate = sessions.reduce((min, s) => (s.date < min ? s.date : min), sessions[0]?.date ?? '')
  const maxDate = sessions.reduce((max, s) => (s.date > max ? s.date : max), sessions[0]?.date ?? '')

  return {
    recordsParsed: allRecords.length,
    nightsComputed: sessions.length,
    elapsedMs: Date.now() - started,
    dateRange: sessions.length > 0 ? { from: minDate, to: maxDate } : null,
  }
}

export async function getLatestImportSummary(): Promise<{
  totalSessions: number
  latestDate: string | null
  avgQuality: number | null
}> {
  const total = db.select({ c: sql<number>`count(*)` }).from(sleepSessions).get()
  const latest = db
    .select({ date: sleepSessions.date })
    .from(sleepSessions)
    .orderBy(sql`date DESC`)
    .limit(1)
    .get()
  const avg = db
    .select({ avg: sql<number>`avg(quality_score)` })
    .from(sleepSessions)
    .get()

  return {
    totalSessions: Number(total?.c ?? 0),
    latestDate: latest?.date ?? null,
    avgQuality: avg?.avg != null ? Number(avg.avg) : null,
  }
}
