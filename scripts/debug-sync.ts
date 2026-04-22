/**
 * Debug script: reads Pi-hole creds from SQLite, fetches a single page of
 * /api/queries, and prints the raw JSON so we can diagnose schema mismatches.
 *
 * Run: npx tsx scripts/debug-sync.ts
 */
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'niteflow.db')
const sqlite = new Database(dbPath, { readonly: true })

function getSetting(key: string): string | null {
  const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

const url = (getSetting('pihole_url') ?? '').replace(/\/$/, '')
const password = getSetting('pihole_password')
const deviceIpsRaw = getSetting('pihole_device_ips')

if (!url.length || !password) {
  console.error('Pi-hole credentials not configured in SQLite. Visit /settings first.')
  process.exit(1)
}

const deviceIps: string[] = deviceIpsRaw ? JSON.parse(deviceIpsRaw) : []
console.log('Pi-hole URL:', url)
console.log('Selected device IPs:', deviceIps)

async function main() {
  // 1. Authenticate
  const authRes = await fetch(`${url}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const authJson = await authRes.json()
  console.log('\n--- AUTH RESPONSE ---')
  console.log(JSON.stringify(authJson, null, 2).slice(0, 500))

  const sid = authJson?.session?.sid
  if (!sid) {
    console.error('No sid returned')
    process.exit(1)
  }

  // 2. Fetch one page of queries (last 30 days)
  const to = Math.floor(Date.now() / 1000)
  const from = to - 30 * 86400

  // Test several candidate parameter names to find the one Pi-hole v6 honors
  const targetIp = deviceIps[0] ?? '192.168.4.36'
  const candidates = ['client_ip', 'client', 'clientIp']

  for (const param of candidates) {
    const queryUrl = new URL(`${url}/api/queries`)
    queryUrl.searchParams.set('from', String(from))
    queryUrl.searchParams.set('until', String(to))
    queryUrl.searchParams.set('length', '10')
    queryUrl.searchParams.set(param, targetIp)

    const queryRes = await fetch(queryUrl.toString(), { headers: { sid } })
    const queryJson = await queryRes.json()

    const uniqueIps = new Set<string>()
    for (const q of queryJson?.queries ?? []) {
      uniqueIps.add(q?.client?.ip ?? 'unknown')
    }

    console.log(`\n--- Filter by '${param}=${targetIp}' ---`)
    console.log('  status:', queryRes.status)
    console.log('  recordsTotal:', queryJson?.recordsTotal)
    console.log('  recordsFiltered:', queryJson?.recordsFiltered)
    console.log('  returned count:', queryJson?.queries?.length)
    console.log('  unique IPs in page:', [...uniqueIps].join(', '))
    if (queryJson?.error) console.log('  error:', queryJson.error)
  }
}

main().catch((err) => {
  console.error('ERROR:', err)
  process.exit(1)
})
