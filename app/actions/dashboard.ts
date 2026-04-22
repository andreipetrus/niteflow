'use server'

import { getSleepTimeline } from '@/lib/db/queries/sleep'
import type { SleepTimelinePoint } from '@/lib/db/queries/sleep'
import { aggregateNightlyCategories } from '@/lib/analytics/aggregate'
import type { NightlyAggregate } from '@/lib/analytics/aggregate'
import { db } from '@/lib/db/client'
import { getSetting } from '@/lib/db/queries/settings'

export async function fetchSleepTimeline(from: string, to: string): Promise<SleepTimelinePoint[]> {
  return getSleepTimeline(from, to)
}

export async function fetchPreSleepActivity(
  from: string,
  to: string,
  windowHours = 3
): Promise<NightlyAggregate[]> {
  const rawIps = getSetting('pihole_device_ips')
  const deviceIps: string[] = rawIps ? (JSON.parse(rawIps) as string[]) : []
  if (deviceIps.length === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = aggregateNightlyCategories(db as any, deviceIps, windowHours)
  return all.filter((n) => n.date >= from && n.date <= to)
}
