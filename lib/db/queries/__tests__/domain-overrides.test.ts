import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { piholeQueries, domainCategories } from '@/lib/db/schema'
import { getUncategorizedDomains, saveUserDomainOverride } from '../domain-overrides'
import { eq } from 'drizzle-orm'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

function createTestDb() {
  const sqlite = new Database(':memory:')
  const d = drizzle(sqlite)
  migrate(d, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return d
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BaseSQLiteDatabase<'sync', any, any>

function seedQuery(db: AnyDb, id: number, domain: string, category: string | null = null) {
  db.insert(piholeQueries)
    .values({ piholeId: id, timestamp: 1700000000, domain, clientIp: '192.168.1.1', status: '2', category })
    .run()
}

describe('getUncategorizedDomains', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  it('returns only domains with null category, ordered by count desc', () => {
    seedQuery(db, 1, 'facebook.com', 'Social Media')
    seedQuery(db, 2, 'reddit.com', null)
    seedQuery(db, 3, 'reddit.com', null)
    seedQuery(db, 4, 'unknown.local', null)

    const rows = getUncategorizedDomains(db as AnyDb)
    expect(rows.map((r) => r.domain)).toEqual(['reddit.com', 'unknown.local'])
    expect(rows[0].count).toBe(2)
    expect(rows[1].count).toBe(1)
  })

  it('returns empty array when all domains are categorized', () => {
    seedQuery(db, 1, 'youtube.com', 'Television')
    const rows = getUncategorizedDomains(db as AnyDb)
    expect(rows).toHaveLength(0)
  })

  it('respects the limit parameter', () => {
    for (let i = 1; i <= 5; i++) seedQuery(db, i, `site${i}.com`, null)
    const rows = getUncategorizedDomains(db as AnyDb, 3)
    expect(rows).toHaveLength(3)
  })
})

describe('saveUserDomainOverride', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(() => {
    db = createTestDb()
  })

  it('upserts into domain_categories with source=user', () => {
    saveUserDomainOverride(db as AnyDb, 'reddit.com', 'Social Media')
    const row = db.select().from(domainCategories).where(eq(domainCategories.domain, 'reddit.com')).get()
    expect(row?.category).toBe('Social Media')
    expect(row?.source).toBe('user')
  })

  it('overwrites an existing domain_categories entry', () => {
    db.insert(domainCategories)
      .values({ domain: 'reddit.com', category: 'Technology & Computing', source: 'inferred', updatedAt: 1 })
      .run()
    saveUserDomainOverride(db as AnyDb, 'reddit.com', 'Social Media')
    const row = db.select().from(domainCategories).where(eq(domainCategories.domain, 'reddit.com')).get()
    expect(row?.category).toBe('Social Media')
    expect(row?.source).toBe('user')
  })

  it('backfills category on all matching pihole_queries rows', () => {
    seedQuery(db, 1, 'reddit.com', null)
    seedQuery(db, 2, 'reddit.com', null)
    seedQuery(db, 3, 'youtube.com', null)

    saveUserDomainOverride(db as AnyDb, 'reddit.com', 'Social Media')

    const redditRows = db.select().from(piholeQueries).where(eq(piholeQueries.domain, 'reddit.com')).all()
    expect(redditRows.every((r) => r.category === 'Social Media')).toBe(true)

    // other domains not affected
    const ytRow = db.select().from(piholeQueries).where(eq(piholeQueries.domain, 'youtube.com')).get()
    expect(ytRow?.category).toBeNull()
  })

  it('removes the domain from uncategorized list after override', () => {
    seedQuery(db, 1, 'reddit.com', null)
    seedQuery(db, 2, 'unknown.local', null)

    saveUserDomainOverride(db as AnyDb, 'reddit.com', 'Social Media')

    const rows = getUncategorizedDomains(db as AnyDb)
    expect(rows.map((r) => r.domain)).toEqual(['unknown.local'])
  })
})
