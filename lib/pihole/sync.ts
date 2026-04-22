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
    name: z.string().nullish(),
  }),
  // status is an integer code in v6 (2=forwarded, 3=cached, 1=blocked-gravity, etc.)
  status: z.union([z.string(), z.number()]).transform(String),
  type: z.union([z.string(), z.number()]).nullish(),
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
  const PAGE_SIZE = 1000

  // Fetch per-client with server-side filtering via client_ip.
  // Pi-hole v6 uses offset-based pagination (start + length), NOT cursor.
  for (const clientIp of selectedIps) {
    let start = 0
    let pageCount = 0

    while (true) {
      const params: Record<string, string | number> = {
        from,
        until: to,
        length: PAGE_SIZE,
        start,
        client_ip: clientIp,
      }

      const raw = await piholeGet<unknown>(config, '/api/queries', params)
      const parsed = PiholeQueriesResponseSchema.safeParse(raw)

      if (!parsed.success) {
        console.error('[pihole] syncQueries: unexpected response shape', parsed.error.issues)
        throw new Error(
          `Pi-hole query response did not match expected format: ${parsed.error.issues[0]?.message}`
        )
      }

      // Safety net: re-filter locally in case the server ignores client_ip
      const queries = parsed.data.queries.filter((q) => q.client.ip === clientIp)

      if (parsed.data.queries.length === 0) break

      for (const q of queries) {
        const ts = Math.floor(q.time)
        const piholeIdNum = typeof q.id === 'number' ? q.id : parseInt(String(q.id), 10)

        const existing = db
          .select({ id: piholeQueries.id })
          .from(piholeQueries)
          .where(eq(piholeQueries.piholeId, piholeIdNum))
          .get()

        if (existing) {
          skipped++
        } else {
          db.insert(piholeQueries)
            .values({
              piholeId: piholeIdNum,
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

      // Stop when the server returned fewer than requested → last page
      if (parsed.data.queries.length < PAGE_SIZE) break

      start += PAGE_SIZE
      pageCount++
      if (pageCount > 1000) {
        throw new Error('Sync aborted: exceeded 1000 pages for a single client')
      }
    }
  }

  return { inserted, skipped, dateRange: { from, to } }
}
