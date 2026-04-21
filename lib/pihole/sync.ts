import { z } from 'zod'
import { piholeGet } from './client'
import type { PiholeClientConfig } from './client'
import { piholeQueries } from '@/lib/db/schema'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { and, eq } from 'drizzle-orm'

const PiholeQuerySchema = z.object({
  id: z.string(),
  time: z.number(),
  domain: z.string(),
  client: z.object({ ip: z.string() }),
  status: z.string(),
  type: z.string().optional(),
})

const PiholeQueriesResponseSchema = z.object({
  queries: z.array(PiholeQuerySchema),
  recordsTotal: z.number(),
  recordsFiltered: z.number(),
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
    const parsed = PiholeQueriesResponseSchema.parse(raw)

    const filtered = parsed.queries.filter((q) => selectedIps.includes(q.client.ip))

    for (const q of filtered) {
      // Check for existing record with same timestamp + domain + client
      const existing = db
        .select({ id: piholeQueries.id })
        .from(piholeQueries)
        .where(
          and(
            eq(piholeQueries.timestamp, q.time),
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
            timestamp: q.time,
            domain: q.domain,
            clientIp: q.client.ip,
            status: q.status,
            category: null,
          })
          .run()
        inserted++
      }
    }

    cursor = parsed.cursor
  } while (cursor != null)

  return { inserted, skipped, dateRange: { from, to } }
}
