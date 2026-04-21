import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { settings, sleepSessions, sleepRecords, piholeQueries, domainCategories } from '../schema'
import { eq } from 'drizzle-orm'

function createTestDb() {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return db
}

describe('database schema', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  it('settings table stores and retrieves key/value pairs', () => {
    db.insert(settings).values({ key: 'pihole_url', value: 'http://pi.hole' }).run()
    const row = db.select().from(settings).where(eq(settings.key, 'pihole_url')).get()
    expect(row?.value).toBe('http://pi.hole')
  })

  it('sleep_sessions table stores nightly aggregates', () => {
    db.insert(sleepSessions)
      .values({
        date: '2024-01-15',
        qualityScore: 72.5,
        totalMin: 420,
        deepPct: 0.18,
        remPct: 0.22,
        hrvAvg: 45.3,
        efficiency: 0.91,
      })
      .run()
    const row = db.select().from(sleepSessions).where(eq(sleepSessions.date, '2024-01-15')).get()
    expect(row?.qualityScore).toBe(72.5)
    expect(row?.totalMin).toBe(420)
  })

  it('sleep_records table stores raw HK records', () => {
    db.insert(sleepRecords)
      .values({
        type: 'HKCategoryTypeIdentifierSleepAnalysis',
        startTs: 1705276800,
        endTs: 1705280400,
        value: 5, // AsleepDeep
        unit: null,
        source: 'Apple Watch',
      })
      .run()
    const rows = db.select().from(sleepRecords).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('HKCategoryTypeIdentifierSleepAnalysis')
  })

  it('pihole_queries table stores DNS query records', () => {
    db.insert(piholeQueries)
      .values({ timestamp: 1705276800, domain: 'youtube.com', clientIp: '192.168.1.10', status: 'OK', category: null })
      .run()
    const rows = db.select().from(piholeQueries).all()
    expect(rows[0].domain).toBe('youtube.com')
    expect(rows[0].category).toBeNull()
  })

  it('domain_categories table stores domain→category mappings with source', () => {
    db.insert(domainCategories)
      .values({ domain: 'youtube.com', category: 'Video Streaming', source: 'curated', updatedAt: 1705276800 })
      .run()
    const row = db.select().from(domainCategories).where(eq(domainCategories.domain, 'youtube.com')).get()
    expect(row?.category).toBe('Video Streaming')
    expect(row?.source).toBe('curated')
  })

  it('settings upsert replaces existing value', () => {
    db.insert(settings).values({ key: 'pihole_url', value: 'http://old.url' }).run()
    db.insert(settings).values({ key: 'pihole_url', value: 'http://new.url' }).onConflictDoUpdate({
      target: settings.key,
      set: { value: 'http://new.url' },
    }).run()
    const row = db.select().from(settings).where(eq(settings.key, 'pihole_url')).get()
    expect(row?.value).toBe('http://new.url')
  })
})
