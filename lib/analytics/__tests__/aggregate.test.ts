import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { piholeQueries, sleepSessions } from '@/lib/db/schema'
import { aggregateNightlyCategories } from '../aggregate'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

function createTestDb() {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return db
}

function ts(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

// Type helper — the real db type has schema, tests use empty schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BaseSQLiteDatabase<'sync', any, any>

describe('aggregateNightlyCategories', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()

    // One sleep session on 2024-01-16 with sleep starting at 22:00 Jan 15
    db.insert(sleepSessions)
      .values({
        date: '2024-01-16',
        sleepStartTs: ts('2024-01-15T22:00:00Z'),
        sleepEndTs: ts('2024-01-16T06:00:00Z'),
        qualityScore: 75,
        totalMin: 480,
        deepPct: 0.2,
        remPct: 0.2,
        hrvAvg: 50,
        efficiency: 0.95,
      })
      .run()

    // Queries in the 3 hours before sleep start (19:00–22:00):
    db.insert(piholeQueries)
      .values([
        { piholeId: 1, timestamp: ts('2024-01-15T19:30:00Z'), domain: 'tiktok.com', clientIp: '10.0.0.1', status: 'OK', category: 'Social Media' },
        { piholeId: 2, timestamp: ts('2024-01-15T20:00:00Z'), domain: 'instagram.com', clientIp: '10.0.0.1', status: 'OK', category: 'Social Media' },
        { piholeId: 3, timestamp: ts('2024-01-15T20:30:00Z'), domain: 'netflix.com', clientIp: '10.0.0.1', status: 'OK', category: 'Television' },
        { piholeId: 4, timestamp: ts('2024-01-15T21:45:00Z'), domain: 'instagram.com', clientIp: '10.0.0.1', status: 'OK', category: 'Social Media' },
        { piholeId: 5, timestamp: ts('2024-01-15T15:00:00Z'), domain: 'nyt.com', clientIp: '10.0.0.1', status: 'OK', category: 'News and Politics' }, // outside window
        { piholeId: 6, timestamp: ts('2024-01-15T22:30:00Z'), domain: 'apple.com', clientIp: '10.0.0.1', status: 'OK', category: null }, // after sleep
        { piholeId: 7, timestamp: ts('2024-01-15T21:00:00Z'), domain: 'other.example', clientIp: '10.0.0.1', status: 'OK', category: null }, // uncategorized
      ])
      .run()
  })

  it('aggregates queries in the pre-sleep window by category', () => {
    const result = aggregateNightlyCategories(db as AnyDb, ['10.0.0.1'], 3)

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2024-01-16')
    // 3 Social Media + 1 Television + 1 Uncategorized in the 3h window
    expect(result[0].totalQueries).toBe(5)
    expect(result[0].byCategory['Social Media']).toBe(3)
    expect(result[0].byCategory['Television']).toBe(1)
    expect(result[0].byCategory['Uncategorized']).toBe(1)
    expect(result[0].byCategory['News and Politics']).toBeUndefined()
  })

  it('excludes nights without sleep_start_ts', () => {
    db.insert(sleepSessions)
      .values({
        date: '2024-01-18',
        sleepStartTs: null,
        sleepEndTs: null,
        qualityScore: 60,
        totalMin: 420,
        deepPct: 0.15,
        remPct: 0.2,
        hrvAvg: 45,
        efficiency: 0.9,
      })
      .run()

    const result = aggregateNightlyCategories(db as AnyDb, ['10.0.0.1'], 3)
    expect(result.map((r) => r.date)).toEqual(['2024-01-16'])
  })

  it('returns nights with zero queries when none are in window', () => {
    db.insert(sleepSessions)
      .values({
        date: '2024-01-20',
        sleepStartTs: ts('2024-01-19T23:00:00Z'),
        sleepEndTs: ts('2024-01-20T06:30:00Z'),
        qualityScore: 70,
        totalMin: 450,
        deepPct: 0.18,
        remPct: 0.2,
        hrvAvg: 48,
        efficiency: 0.92,
      })
      .run()

    const result = aggregateNightlyCategories(db as AnyDb, ['10.0.0.1'], 3)
    const night20 = result.find((r) => r.date === '2024-01-20')
    expect(night20).toBeDefined()
    expect(night20!.totalQueries).toBe(0)
    expect(night20!.byCategory).toEqual({})
  })

  it('filters to selected device IPs only', () => {
    db.insert(piholeQueries)
      .values({
        piholeId: 99,
        timestamp: ts('2024-01-15T20:00:00Z'),
        domain: 'reddit.com',
        clientIp: '10.0.0.99',
        status: 'OK',
        category: 'Social Media',
      })
      .run()

    const result = aggregateNightlyCategories(db as AnyDb, ['10.0.0.1'], 3)
    // Only 10.0.0.1's Social Media queries counted, not 10.0.0.99
    expect(result[0].byCategory['Social Media']).toBe(3)
  })
})
