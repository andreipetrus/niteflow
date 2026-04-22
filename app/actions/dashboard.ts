'use server'

import { getSleepTimeline } from '@/lib/db/queries/sleep'
import type { SleepTimelinePoint } from '@/lib/db/queries/sleep'

export async function fetchSleepTimeline(from: string, to: string): Promise<SleepTimelinePoint[]> {
  return getSleepTimeline(from, to)
}
