import { sleepSessions } from '../schema'
import { and, gte, lte, sql } from 'drizzle-orm'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { db as defaultDb } from '../client'

export type SleepTimelinePoint = {
  date: string
  qualityScore: number
  totalMin: number
  hrvAvg: number | null
  deepPct: number
  remPct: number
  efficiency: number
}

/**
 * Returns sleep sessions within [from, to] (both inclusive, YYYY-MM-DD),
 * sorted ascending. Accepts a Drizzle db parameter for testability;
 * callers that don't need to swap the DB can use getSleepTimeline below.
 */
export function getSleepTimelineRange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: BaseSQLiteDatabase<'sync', any, any>,
  from: string,
  to: string
): SleepTimelinePoint[] {
  return db
    .select({
      date: sleepSessions.date,
      qualityScore: sleepSessions.qualityScore,
      totalMin: sleepSessions.totalMin,
      hrvAvg: sleepSessions.hrvAvg,
      deepPct: sleepSessions.deepPct,
      remPct: sleepSessions.remPct,
      efficiency: sleepSessions.efficiency,
    })
    .from(sleepSessions)
    .where(and(gte(sleepSessions.date, from), lte(sleepSessions.date, to)))
    .orderBy(sql`date ASC`)
    .all()
}

export function getSleepTimeline(from: string, to: string): SleepTimelinePoint[] {
  return getSleepTimelineRange(defaultDb, from, to)
}
