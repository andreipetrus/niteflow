import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { piholeQueries } from '@/lib/db/schema'

// Mock the pihole client
vi.mock('@/lib/pihole/client', () => ({
  piholeGet: vi.fn(),
}))

const { piholeGet } = await import('@/lib/pihole/client')
const { syncQueries } = await import('../sync')

function createTestDb() {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
  return db
}

beforeEach(() => {
  vi.mocked(piholeGet).mockReset()
})

describe('syncQueries', () => {
  it('inserts fetched queries into the database', async () => {
    const db = createTestDb()

    vi.mocked(piholeGet).mockResolvedValueOnce({
      queries: [
        { id: '1', time: 1705276800, domain: 'youtube.com', client: { ip: '192.168.1.10' }, status: 'OK', type: 'A' },
        { id: '2', time: 1705276900, domain: 'instagram.com', client: { ip: '192.168.1.10' }, status: 'OK', type: 'A' },
      ],
      recordsTotal: 2,
      recordsFiltered: 2,
      cursor: null,
    })

    const result = await syncQueries(
      db,
      { url: 'http://pi.hole', password: 'pw', allowInsecure: false },
      ['192.168.1.10'],
      1705276800,
      1705363200
    )

    expect(result.inserted).toBe(2)
    const rows = db.select().from(piholeQueries).all()
    expect(rows).toHaveLength(2)
    expect(rows[0].domain).toBe('youtube.com')
    expect(rows[1].domain).toBe('instagram.com')
  })

  it('skips duplicate queries (idempotent re-sync)', async () => {
    const db = createTestDb()

    const sameResponse = {
      queries: [
        { id: '1', time: 1705276800, domain: 'youtube.com', client: { ip: '192.168.1.10' }, status: 'OK', type: 'A' },
      ],
      recordsTotal: 1,
      recordsFiltered: 1,
      cursor: null,
    }
    vi.mocked(piholeGet).mockResolvedValue(sameResponse)

    await syncQueries(
      db,
      { url: 'http://pi.hole', password: 'pw', allowInsecure: false },
      ['192.168.1.10'],
      1705276800,
      1705363200
    )
    const result2 = await syncQueries(
      db,
      { url: 'http://pi.hole', password: 'pw', allowInsecure: false },
      ['192.168.1.10'],
      1705276800,
      1705363200
    )

    expect(result2.inserted).toBe(0)
    expect(result2.skipped).toBe(1)
    expect(db.select().from(piholeQueries).all()).toHaveLength(1)
  })

  it('filters to selected client IPs only', async () => {
    const db = createTestDb()

    vi.mocked(piholeGet).mockResolvedValueOnce({
      queries: [
        { id: '1', time: 1705276800, domain: 'youtube.com', client: { ip: '192.168.1.10' }, status: 'OK', type: 'A' },
        { id: '2', time: 1705276900, domain: 'netflix.com', client: { ip: '192.168.1.99' }, status: 'OK', type: 'A' },
      ],
      recordsTotal: 2,
      recordsFiltered: 2,
      cursor: null,
    })

    const result = await syncQueries(
      db,
      { url: 'http://pi.hole', password: 'pw', allowInsecure: false },
      ['192.168.1.10'], // only watch this IP
      1705276800,
      1705363200
    )

    expect(result.inserted).toBe(1)
    const rows = db.select().from(piholeQueries).all()
    expect(rows[0].clientIp).toBe('192.168.1.10')
  })

  it('returns zero counts when API returns empty queries', async () => {
    const db = createTestDb()

    vi.mocked(piholeGet).mockResolvedValueOnce({
      queries: [],
      recordsTotal: 0,
      recordsFiltered: 0,
      cursor: null,
    })

    const result = await syncQueries(
      db,
      { url: 'http://pi.hole', password: 'pw', allowInsecure: false },
      ['192.168.1.10'],
      1705276800,
      1705363200
    )

    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(0)
  })
})
