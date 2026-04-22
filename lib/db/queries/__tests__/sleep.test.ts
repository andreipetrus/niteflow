import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { sleepSessions } from '@/lib/db/schema'
import { getSleepTimelineRange } from '../sleep'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

function createTestDb() {
  const sqlite = new Database(':memory:')
  const d = drizzle(sqlite)
  migrate(d, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return d
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BaseSQLiteDatabase<'sync', any, any>

describe('getSleepTimelineRange', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
    db.insert(sleepSessions)
      .values([
        { date: '2024-01-10', sleepStartTs: null, sleepEndTs: null, qualityScore: 60, totalMin: 400, deepPct: 0.1, remPct: 0.2, hrvAvg: 40, efficiency: 0.9 },
        { date: '2024-01-15', sleepStartTs: null, sleepEndTs: null, qualityScore: 72, totalMin: 450, deepPct: 0.15, remPct: 0.2, hrvAvg: 45, efficiency: 0.92 },
        { date: '2024-01-20', sleepStartTs: null, sleepEndTs: null, qualityScore: 80, totalMin: 480, deepPct: 0.18, remPct: 0.22, hrvAvg: 50, efficiency: 0.95 },
        { date: '2024-02-01', sleepStartTs: null, sleepEndTs: null, qualityScore: 65, totalMin: 420, deepPct: 0.12, remPct: 0.18, hrvAvg: null, efficiency: 0.88 },
      ])
      .run()
  })

  it('returns sessions within [from, to] inclusive, sorted ascending', () => {
    const rows = getSleepTimelineRange(db as AnyDb, '2024-01-10', '2024-01-20')
    expect(rows.map((r) => r.date)).toEqual(['2024-01-10', '2024-01-15', '2024-01-20'])
  })

  it('excludes sessions outside the range', () => {
    const rows = getSleepTimelineRange(db as AnyDb, '2024-01-12', '2024-01-18')
    expect(rows.map((r) => r.date)).toEqual(['2024-01-15'])
  })

  it('returns empty array when no sessions match', () => {
    const rows = getSleepTimelineRange(db as AnyDb, '2025-01-01', '2025-12-31')
    expect(rows).toEqual([])
  })

  it('preserves null hrvAvg', () => {
    const rows = getSleepTimelineRange(db as AnyDb, '2024-02-01', '2024-02-01')
    expect(rows[0].hrvAvg).toBeNull()
  })
})
