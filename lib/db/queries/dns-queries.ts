import { db } from '../client'
import { piholeQueries } from '../schema'
import { sql, inArray, and, not, like, type SQL } from 'drizzle-orm'

export type DomainCount = {
  domain: string
  total: number
  byDevice: Record<string, number>
}

// Noise patterns excluded unless includeNoise=true
const NOISE_PATTERNS = ['%.arpa', '%.local', '%_dns-sd%', '%._udp.%', '%._tcp.%']

function noiseFilter(): SQL {
  return and(
    ...NOISE_PATTERNS.map((p) => not(like(piholeQueries.domain, p)))
  ) as SQL
}

export function getTopDomainsByDevice(
  deviceIps: string[],
  limit: number,
  includeNoise = false
): DomainCount[] {
  if (deviceIps.length === 0) return []

  const whereClause = includeNoise
    ? inArray(piholeQueries.clientIp, deviceIps)
    : and(inArray(piholeQueries.clientIp, deviceIps), noiseFilter())

  const totals = db
    .select({
      domain: piholeQueries.domain,
      total: sql<number>`count(*)`.as('total'),
    })
    .from(piholeQueries)
    .where(whereClause)
    .groupBy(piholeQueries.domain)
    .orderBy(sql`total DESC`)
    .limit(limit)
    .all()

  if (totals.length === 0) return []

  const topDomains = totals.map((t) => t.domain)

  const breakdown = db
    .select({
      domain: piholeQueries.domain,
      clientIp: piholeQueries.clientIp,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(piholeQueries)
    .where(
      and(
        inArray(piholeQueries.clientIp, deviceIps),
        inArray(piholeQueries.domain, topDomains)
      )
    )
    .groupBy(piholeQueries.domain, piholeQueries.clientIp)
    .all()

  const byDomain = new Map<string, Record<string, number>>()
  for (const b of breakdown) {
    const cur = byDomain.get(b.domain) ?? {}
    cur[b.clientIp] = Number(b.count)
    byDomain.set(b.domain, cur)
  }

  return totals.map((t) => ({
    domain: t.domain,
    total: Number(t.total),
    byDevice: byDomain.get(t.domain) ?? {},
  }))
}
