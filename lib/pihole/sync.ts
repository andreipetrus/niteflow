import { z } from 'zod'
import { piholeGet } from './client'
import type { PiholeClientConfig } from './client'
import { piholeQueries } from '@/lib/db/schema'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { and, eq } from 'drizzle-orm'

// Pi-hole v6 returns id/status/type as numbers, time as a float Unix timestamp
const PiholeQuerySchema = z.object({
  id: z.union([z.string(), z.number()]),
  time: z.number(),
  domain: z.string(),
  client: z.object({
    ip: z.string(),
    name: z.string().optional(),
  }),
  // status is an integer code in v6 (2=forwarded, 3=cached, 1=blocked-gravity, etc.)
  status: z.union([z.string(), z.number()]).transform(String),
  type: z.union([z.string(), z.number()]).optional(),
})

const PiholeQueriesResponseSchema = z.object({
  queries: z.array(PiholeQuerySchema),
  recordsTotal: z.number().optional(),
  recordsFiltered: z.number().optional(),
  // cursor is a number when more pages exist, absent or null when done
  cursor: z.number().nullable().optional(),
})

export type SyncResult = {
  inserted: number
  skipped: number
  dateRange: { from: number; to: number }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncQueries(
  db: BaseSQLiteDatabase<'sync', any, any>,
  config: PiholeClientConfig,
  selectedIps: string[],
  from: number,
  to: number
): Promise<SyncResult> {
  let inserted = 0
  let skipped = 0
  let cursor: number | null | undefined = undefined
  const PAGE_SIZE = 500

  do {
    const params: Record<string, string | number> = {
      from,
      until: to,
      length: PAGE_SIZE,
    }
    if (cursor != null) params.cursor = cursor

    const raw = await piholeGet<unknown>(config, '/api/queries', params)
    const parsed = PiholeQueriesResponseSchema.safeParse(raw)

    if (!parsed.success) {
      console.error('[pihole] syncQueries: unexpected response shape', parsed.error.issues)
      throw new Error(`Pi-hole query response did not match expected format: ${parsed.error.issues[0]?.message}`)
    }

    const filtered = parsed.data.queries.filter((q) => selectedIps.includes(q.client.ip))

    for (const q of filtered) {
      // Use floor so float timestamps (Pi-hole v6 includes ms) match on re-sync
      const ts = Math.floor(q.time)

      const existing = db
        .select({ id: piholeQueries.id })
        .from(piholeQueries)
        .where(
          and(
            eq(piholeQueries.timestamp, ts),
            eq(piholeQueries.domain, q.domain),
            eq(piholeQueries.clientIp, q.client.ip)
          )
        )
        .get()

      if (existing) {
        skipped++
      } else {
        db.insert(piholeQueries)
          .values({
            timestamp: ts,
            domain: q.domain,
            clientIp: q.client.ip,
            status: q.status,
            category: null,
          })
          .run()
        inserted++
      }
    }

    cursor = parsed.data.cursor
  } while (cursor != null)

  return { inserted, skipped, dateRange: { from, to } }
}
