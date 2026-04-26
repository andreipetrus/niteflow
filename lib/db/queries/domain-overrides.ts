import { db as defaultDb } from '../client'
import { piholeQueries, domainCategories } from '../schema'
import { sql, isNull, eq } from 'drizzle-orm'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BaseSQLiteDatabase<'sync', any, any>

export type UncategorizedDomain = {
  domain: string
  count: number
}

export function getUncategorizedDomains(db: AnyDb, limit = 100): UncategorizedDomain[] {
  return db
    .select({
      domain: piholeQueries.domain,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(piholeQueries)
    .where(isNull(piholeQueries.category))
    .groupBy(piholeQueries.domain)
    .orderBy(sql`count DESC`)
    .limit(limit)
    .all()
    .map((r) => ({ domain: r.domain, count: Number(r.count) }))
}

export function saveUserDomainOverride(db: AnyDb, domain: string, category: string): void {
  const now = Math.floor(Date.now() / 1000)

  db.insert(domainCategories)
    .values({ domain, category, source: 'user', updatedAt: now })
    .onConflictDoUpdate({
      target: domainCategories.domain,
      set: { category, source: 'user', updatedAt: now },
    })
    .run()

  db.update(piholeQueries)
    .set({ category })
    .where(eq(piholeQueries.domain, domain))
    .run()
}

// Convenience wrappers that use the singleton db
export function getUncategorizedDomainsDefault(limit = 100) {
  return getUncategorizedDomains(defaultDb, limit)
}

export function saveUserDomainOverrideDefault(domain: string, category: string) {
  return saveUserDomainOverride(defaultDb, domain, category)
}
