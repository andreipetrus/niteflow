import { piholeQueries, sleepSessions } from '@/lib/db/schema'
import { sql, and, gte, lt, inArray, isNotNull } from 'drizzle-orm'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

export type NightlyAggregate = {
  date: string
  sleepStartTs: number
  totalQueries: number
  byCategory: Record<string, number>
}

/**
 * For each night with a sleep session that has a resolved sleep-start
 * timestamp, aggregates Pi-hole queries in the N-hour window preceding
 * sleep start, grouped by category. Uncategorized queries are counted
 * under "Uncategorized".
 *
 * Only queries from the provided device IPs are counted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aggregateNightlyCategories(
  db: BaseSQLiteDatabase<'sync', any, any>,
  deviceIps: string[],
  windowHours: number
): NightlyAggregate[] {
  if (deviceIps.length === 0) return []

  const sessions = db
    .select({
      date: sleepSessions.date,
      sleepStartTs: sleepSessions.sleepStartTs,
    })
    .from(sleepSessions)
    .where(isNotNull(sleepSessions.sleepStartTs))
    .orderBy(sql`date ASC`)
    .all()

  const results: NightlyAggregate[] = []
  const windowSeconds = windowHours * 3600

  for (const { date, sleepStartTs } of sessions) {
    if (sleepStartTs == null) continue

    const windowStart = sleepStartTs - windowSeconds

    const rows = db
      .select({
        category: sql<string>`COALESCE(category, 'Uncategorized')`,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(piholeQueries)
      .where(
        and(
          gte(piholeQueries.timestamp, windowStart),
          lt(piholeQueries.timestamp, sleepStartTs),
          inArray(piholeQueries.clientIp, deviceIps)
        )
      )
      .groupBy(sql`COALESCE(category, 'Uncategorized')`)
      .all()

    const byCategory: Record<string, number> = {}
    let total = 0
    for (const r of rows) {
      byCategory[r.category] = Number(r.count)
      total += Number(r.count)
    }

    results.push({ date, sleepStartTs, totalQueries: total, byCategory })
  }

  return results
}
