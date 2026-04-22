'use server'

import { TAXONOMY_SOURCES } from '@/data/taxonomy-sources'
import type { TaxonomySource } from '@/data/taxonomy-sources'
import { fetchTaxonomySource } from '@/lib/taxonomy/loader'
import { db } from '@/lib/db/client'
import { domainCategories, piholeQueries } from '@/lib/db/schema'
import { getSetting, setSetting } from '@/lib/db/queries/settings'
import { eq, and, isNotNull, sql } from 'drizzle-orm'

export type TaxonomyState = {
  source: TaxonomySource
  enabled: boolean
  lastLoadedAt: number | null
  domainCount: number
}

function getEnabledIds(): Set<string> {
  const raw = getSetting('taxonomy_enabled')
  if (!raw) return new Set()
  try {
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function setEnabledIds(ids: Set<string>) {
  setSetting('taxonomy_enabled', JSON.stringify([...ids]))
}

function getLoadedMeta(): Record<string, { at: number; count: number }> {
  const raw = getSetting('taxonomy_loaded')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, { at: number; count: number }>
  } catch {
    return {}
  }
}

function setLoadedMeta(meta: Record<string, { at: number; count: number }>) {
  setSetting('taxonomy_loaded', JSON.stringify(meta))
}

export async function getTaxonomyState(): Promise<TaxonomyState[]> {
  const enabledIds = getEnabledIds()
  const loadedMeta = getLoadedMeta()

  return TAXONOMY_SOURCES.map((source) => ({
    source,
    enabled: enabledIds.has(source.id),
    lastLoadedAt: loadedMeta[source.id]?.at ?? null,
    domainCount: loadedMeta[source.id]?.count ?? 0,
  }))
}

export async function toggleTaxonomy(id: string, enabled: boolean): Promise<void> {
  const ids = getEnabledIds()
  if (enabled) ids.add(id)
  else ids.delete(id)
  setEnabledIds(ids)
}

export type ApplyResult = {
  ok: boolean
  summary: { sourceId: string; name: string; domainCount: number; error?: string }[]
  queriesRecategorized: number
}

export async function applyTaxonomies(): Promise<ApplyResult> {
  const enabledIds = getEnabledIds()
  const enabledSources = TAXONOMY_SOURCES.filter((s) => enabledIds.has(s.id))
  const now = Math.floor(Date.now() / 1000)

  const summary: ApplyResult['summary'] = []
  const loadedMeta = getLoadedMeta()

  for (const source of enabledSources) {
    try {
      const domains = await fetchTaxonomySource(source)

      // Upsert per domain. Never overwrite user-assigned categories.
      db.transaction((tx) => {
        for (const domain of domains) {
          const existing = tx
            .select({ source: domainCategories.source })
            .from(domainCategories)
            .where(eq(domainCategories.domain, domain))
            .get()

          if (existing?.source === 'user') continue

          tx.insert(domainCategories)
            .values({
              domain,
              category: source.category,
              source: `taxonomy:${source.id}`,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: domainCategories.domain,
              set: {
                category: source.category,
                source: `taxonomy:${source.id}`,
                updatedAt: now,
              },
            })
            .run()
        }
      })

      loadedMeta[source.id] = { at: now, count: domains.length }
      summary.push({ sourceId: source.id, name: source.name, domainCount: domains.length })
    } catch (err) {
      summary.push({
        sourceId: source.id,
        name: source.name,
        domainCount: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  setLoadedMeta(loadedMeta)

  // Re-categorize existing Pi-hole queries based on the refreshed taxonomy.
  const updateResult = db.run(sql`
    UPDATE pihole_queries
    SET category = (
      SELECT category FROM domain_categories WHERE domain_categories.domain = pihole_queries.domain
    )
    WHERE EXISTS (
      SELECT 1 FROM domain_categories WHERE domain_categories.domain = pihole_queries.domain
    )
  `)
  void updateResult

  // Count how many queries now have a category set
  const totalCategorized = db
    .select({ c: sql<number>`count(*)` })
    .from(piholeQueries)
    .where(and(isNotNull(piholeQueries.category)))
    .get()

  return {
    ok: true,
    summary,
    queriesRecategorized: Number(totalCategorized?.c ?? 0),
  }
}
