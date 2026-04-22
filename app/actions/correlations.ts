'use server'

import { db } from '@/lib/db/client'
import { getSetting } from '@/lib/db/queries/settings'
import { aggregateNightlyCategories } from '@/lib/analytics/aggregate'
import {
  computeAllCorrelations,
  SLEEP_METRICS,
} from '@/lib/analytics/correlate'
import type {
  CorrelationResult,
  NightlyDataPoint,
  SleepMetric,
} from '@/lib/analytics/correlate'
import { sleepSessions } from '@/lib/db/schema'

export type CorrelationSnapshot = {
  results: CorrelationResult[]
  categories: string[]
  metrics: SleepMetric[]
  totalNights: number
  nightsWithQueries: number
  nightlyData: NightlyDataPoint[]
}

function selectedDeviceIps(): string[] {
  const raw = getSetting('pihole_device_ips')
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function joinNightly(windowHours: number): NightlyDataPoint[] {
  const ips = selectedDeviceIps()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aggregates = aggregateNightlyCategories(db as any, ips, windowHours)
  const byDate = new Map(aggregates.map((a) => [a.date, a]))

  const sessions = db
    .select({
      date: sleepSessions.date,
      qualityScore: sleepSessions.qualityScore,
      totalMin: sleepSessions.totalMin,
      deepPct: sleepSessions.deepPct,
      remPct: sleepSessions.remPct,
      hrvAvg: sleepSessions.hrvAvg,
      efficiency: sleepSessions.efficiency,
    })
    .from(sleepSessions)
    .all()

  return sessions.map((s) => ({
    date: s.date,
    qualityScore: s.qualityScore,
    totalMin: s.totalMin,
    deepPct: s.deepPct,
    remPct: s.remPct,
    hrvAvg: s.hrvAvg,
    efficiency: s.efficiency,
    categoryCounts: byDate.get(s.date)?.byCategory ?? {},
  }))
}

export async function getCorrelationSnapshot(windowHours = 3): Promise<CorrelationSnapshot> {
  const nightly = joinNightly(windowHours)
  const results = computeAllCorrelations(nightly)

  const categorySet = new Set<string>()
  for (const r of results) categorySet.add(r.category)
  const categories = [...categorySet].sort()

  const nightsWithQueries = nightly.filter((n) =>
    Object.keys(n.categoryCounts).length > 0
  ).length

  return {
    results,
    categories,
    metrics: SLEEP_METRICS,
    totalNights: nightly.length,
    nightsWithQueries,
    // Only ship the paired-nights to the client (to keep the payload small)
    nightlyData: nightly.filter((n) => Object.keys(n.categoryCounts).length > 0),
  }
}
