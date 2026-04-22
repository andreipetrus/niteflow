import sax from 'sax'
import type { Readable } from 'stream'

export type HealthRecord = {
  type: string
  startTs: number // Unix seconds
  endTs: number
  value: string | null
  unit: string | null
  source: string | null
}

// The five record types we care about, per SPEC §3.2.
export const RELEVANT_TYPES = new Set([
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
])

/**
 * Parses an Apple Health date string: "YYYY-MM-DD HH:mm:ss ±HHMM"
 * Returns Unix seconds. Returns NaN for malformed input.
 */
export function parseAppleDate(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s)
  if (!m) return NaN
  const [, y, mo, d, h, mi, se, sign, oh, om] = m
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}${sign}${oh}:${om}`
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return NaN
  return Math.floor(ms / 1000)
}

/**
 * Streams an Apple Health `export.xml` and yields typed HealthRecord
 * objects for the subset of record types we care about. SAX-based so
 * memory usage is O(1) regardless of file size (Apple exports are
 * routinely 1–2 GB).
 */
export async function* parseHealthXml(
  input: Readable
): AsyncGenerator<HealthRecord, void, unknown> {
  const parser = sax.createStream(true, { lowercase: false, trim: false })

  const pending: HealthRecord[] = []
  let done = false
  let error: Error | null = null
  let waitResolve: (() => void) | null = null

  function notify() {
    if (waitResolve) {
      const r = waitResolve
      waitResolve = null
      r()
    }
  }

  parser.on('opentag', (node: sax.Tag) => {
    if (node.name !== 'Record') return
    const attrs = node.attributes as Record<string, string>
    const type = attrs.type
    if (!type || !RELEVANT_TYPES.has(type)) return

    const startTs = parseAppleDate(attrs.startDate ?? '')
    const endTs = parseAppleDate(attrs.endDate ?? attrs.startDate ?? '')
    if (Number.isNaN(startTs) || Number.isNaN(endTs)) return

    pending.push({
      type,
      startTs,
      endTs,
      value: attrs.value ?? null,
      unit: attrs.unit ?? null,
      source: attrs.sourceName ?? null,
    })
    notify()
  })

  parser.on('error', (err) => {
    error = err
    done = true
    notify()
  })

  parser.on('end', () => {
    done = true
    notify()
  })

  input.pipe(parser)

  while (true) {
    if (error) throw error
    if (pending.length > 0) {
      yield pending.shift()!
      continue
    }
    if (done) return
    await new Promise<void>((resolve) => {
      waitResolve = resolve
    })
  }
}
