'use server'

import { loadCurlieTaxonomy, taxonomySize } from '@/lib/taxonomy/curlie'
import { categorizeDomain } from '@/lib/taxonomy/categorize'
import { IAB_CATEGORIES } from '@/data/iab-categories'
import type { IabCategory } from '@/data/iab-categories'
import { db } from '@/lib/db/client'
import { domainCategories, piholeQueries } from '@/lib/db/schema'
import { getSetting, setSetting } from '@/lib/db/queries/settings'
import { eq, isNotNull, sql } from 'drizzle-orm'

export type TaxonomyStatus = {
  loaded: boolean
  domainCount: number
  loadedAt: number | null
  categoriesInDb: number
  categorizedQueries: number
  iabCategories: IabCategory[]
}

export async function getTaxonomyStatus(): Promise<TaxonomyStatus> {
  const loadedAt = getSetting('curlie_loaded_at')
  const domainCountStr = getSetting('curlie_domain_count')

  const categoriesInDb = db
    .select({ c: sql<number>`count(*)` })
    .from(domainCategories)
    .get()

  const categorizedQueries = db
    .select({ c: sql<number>`count(*)` })
    .from(piholeQueries)
    .where(isNotNull(piholeQueries.category))
    .get()

  return {
    loaded: Boolean(loadedAt),
    domainCount: domainCountStr ? Number(domainCountStr) : 0,
    loadedAt: loadedAt ? Number(loadedAt) : null,
    categoriesInDb: Number(categoriesInDb?.c ?? 0),
    categorizedQueries: Number(categorizedQueries?.c ?? 0),
    iabCategories: IAB_CATEGORIES.filter((c) => c.id !== 'other'),
  }
}

export type ApplyTaxonomyResult =
  | { ok: true; domainsLoaded: number; queriesCategorized: number; elapsedMs: number }
  | { ok: false; error: string }

export async function applyCurlieTaxonomy(): Promise<ApplyTaxonomyResult> {
  const started = Date.now()

  let taxonomy: Record<string, string>
  try {
    taxonomy = loadCurlieTaxonomy()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const entries = Object.entries(taxonomy)
  const now = Math.floor(Date.now() / 1000)
  const source = 'curlie'

  // Single transaction → 500K upserts is seconds rather than minutes.
  // User-assigned categories (source='user') are preserved.
  db.transaction((tx) => {
    // Wipe previous curlie rows (so a reload with updated data replaces cleanly)
    tx.delete(domainCategories).where(eq(domainCategories.source, source)).run()

    for (const [domain, category] of entries) {
      // Don't clobber user overrides that may have landed under the same domain
      const existing = tx
        .select({ source: domainCategories.source })
        .from(domainCategories)
        .where(eq(domainCategories.domain, domain))
        .get()

      if (existing?.source === 'user') continue

      tx.insert(domainCategories)
        .values({ domain, category, source, updatedAt: now })
        .onConflictDoUpdate({
          target: domainCategories.domain,
          set: { category, source, updatedAt: now },
        })
        .run()
    }
  })

  // Re-categorize existing pihole_queries using the progressive-subdomain
  // fallback in categorizeDomain. We compute categories per unique domain,
  // then bulk-update pihole_queries by domain.
  const distinctDomains = db
    .selectDistinct({ domain: piholeQueries.domain })
    .from(piholeQueries)
    .all()

  db.transaction((tx) => {
    for (const { domain } of distinctDomains) {
      const category = categorizeDomain(domain, taxonomy)
      if (category) {
        tx.run(
          sql`UPDATE pihole_queries SET category = ${category} WHERE domain = ${domain}`
        )
      }
    }
  })

  setSetting('curlie_loaded_at', String(now))
  setSetting('curlie_domain_count', String(entries.length))

  const queriesCategorized = db
    .select({ c: sql<number>`count(*)` })
    .from(piholeQueries)
    .where(isNotNull(piholeQueries.category))
    .get()

  return {
    ok: true,
    domainsLoaded: entries.length,
    queriesCategorized: Number(queriesCategorized?.c ?? 0),
    elapsedMs: Date.now() - started,
  }
}

export type PackAvailability = {
  available: boolean
  domainCount: number
}

export async function checkTaxonomyPack(): Promise<PackAvailability> {
  const size = taxonomySize()
  return { available: size > 0, domainCount: size }
}
