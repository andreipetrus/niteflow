/**
 * TEST-ONLY: replicates the real 24h of Pi-hole queries across the last
 * N nights with a deterministic random subsample each night. Creates
 * enough variance for the correlation engine to produce a non-trivial
 * matrix on synthetic data.
 *
 * Does NOT touch the original 24h of queries. Tags synthetic rows with
 * pihole_id = original_id + (dayOffset * 1_000_000) so they're uniquely
 * identifiable and easy to wipe.
 */
import Database from 'better-sqlite3'
import path from 'path'

const SYNTH_ID_OFFSET = 1_000_000_000 // above any realistic pihole_id

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))
sqlite.pragma('journal_mode = WAL')

// Seeded RNG (mulberry32) for per-date determinism
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashDate(date: string): number {
  let h = 0
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0
  return h >>> 0
}

function main() {
  // Wipe any previous synthetic data
  const wiped = sqlite
    .prepare('DELETE FROM pihole_queries WHERE pihole_id >= ?')
    .run(SYNTH_ID_OFFSET).changes
  console.log(`Wiped ${wiped.toLocaleString()} previous synthetic rows`)

  // Source data: the real 24h of queries we have
  const source = sqlite
    .prepare(
      `SELECT pihole_id, timestamp, domain, client_ip, status, category
       FROM pihole_queries WHERE pihole_id < ?`
    )
    .all(SYNTH_ID_OFFSET) as Array<{
    pihole_id: number
    timestamp: number
    domain: string
    client_ip: string
    status: string
    category: string | null
  }>

  if (source.length === 0) {
    console.error('No source queries to replicate. Run sync first.')
    process.exit(1)
  }

  console.log(`Source: ${source.length.toLocaleString()} real queries`)
  const realMinTs = Math.min(...source.map((r) => r.timestamp))
  console.log(`Real timestamp range starts at: ${new Date(realMinTs * 1000).toISOString()}`)

  // Which dates to spread across — last 60 sleep sessions
  const sessions = sqlite
    .prepare('SELECT date FROM sleep_sessions ORDER BY date DESC LIMIT 60')
    .all() as Array<{ date: string }>

  // We skip date offset=0 because the real queries already cover "today"
  const targetDates = sessions.slice(1).map((s) => s.date)
  console.log(`Replicating across ${targetDates.length} nights (${targetDates[targetDates.length - 1]} → ${targetDates[0]})`)

  const insert = sqlite.prepare(
    `INSERT OR IGNORE INTO pihole_queries
     (pihole_id, timestamp, domain, client_ip, status, category)
     VALUES (?, ?, ?, ?, ?, ?)`
  )

  let totalInserted = 0
  const todayMidnight = Math.floor(new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime() / 1000)

  sqlite.exec('BEGIN')
  for (let i = 0; i < targetDates.length; i++) {
    const date = targetDates[i]
    const dayOffset = i + 1 // 1..N days ago
    const targetMidnight = Math.floor(new Date(date + 'T00:00:00Z').getTime() / 1000)
    const tsShift = targetMidnight - todayMidnight // negative, shifts into the past

    // Per-date seeded RNG
    const random = rng(hashDate(date))

    // Random subsample between 30% and 100% of queries
    const keepPct = 0.3 + random() * 0.7

    // Give some nights disproportionately-high Social Media or Adult content
    // so the correlation engine has a real signal to detect.
    // Category multipliers (per-date, deterministic via seed)
    const categoryMultipliers: Record<string, number> = {
      'Social Media': 0.3 + random() * 1.7, // 0.3× to 2×
      Television: 0.5 + random() * 1.5,
      'Video Gaming': 0.4 + random() * 1.6,
      'Technology & Computing': 0.7 + random() * 0.6,
    }

    let insertedThisNight = 0
    for (const row of source) {
      const mult = row.category ? (categoryMultipliers[row.category] ?? 1) : 1
      if (random() > keepPct * mult) continue

      const newTs = row.timestamp + tsShift
      const newId = SYNTH_ID_OFFSET + dayOffset * 1_000_000 + (row.pihole_id % 1_000_000)

      insert.run(newId, newTs, row.domain, row.client_ip, row.status, row.category)
      insertedThisNight++
    }

    totalInserted += insertedThisNight
  }
  sqlite.exec('COMMIT')

  console.log(`\nInserted ${totalInserted.toLocaleString()} synthetic queries across ${targetDates.length} nights`)

  // Summary
  const totalRows = (sqlite.prepare('SELECT COUNT(*) as c FROM pihole_queries').get() as { c: number }).c
  const range = sqlite
    .prepare('SELECT MIN(timestamp) as min, MAX(timestamp) as max FROM pihole_queries')
    .get() as { min: number; max: number }
  console.log(`Total pihole_queries: ${totalRows.toLocaleString()}`)
  console.log(`Date range: ${new Date(range.min * 1000).toISOString()} → ${new Date(range.max * 1000).toISOString()}`)
}

main()
