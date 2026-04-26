/**
 * Enumerates all clients known to Pi-hole over 91 days and reports the
 * oldest query timestamp for each. Helps isolate whether short history
 * is device-specific or Pi-hole-wide.
 */
import Database from 'better-sqlite3'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'), { readonly: true })
const url = ((sqlite.prepare("SELECT value FROM settings WHERE key='pihole_url'").get() as { value: string } | undefined)?.value ?? '').replace(/\/$/, '')
const password = (sqlite.prepare("SELECT value FROM settings WHERE key='pihole_password'").get() as { value: string } | undefined)?.value

async function main() {
  const authRes = await fetch(`${url}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const auth = (await authRes.json()) as { session: { sid: string } }
  const sid = auth.session.sid

  const now = Math.floor(Date.now() / 1000)
  const from91 = now - 91 * 86400

  // Fetch the devices (same shape our app uses)
  const devRes = await fetch(`${url}/api/network/devices`, { headers: { sid } })
  const devRaw = (await devRes.json()) as {
    devices: Array<{ ips?: Array<{ ip: string }>; name?: string }>
  }

  const ips = new Set<string>()
  for (const d of devRaw.devices ?? []) {
    for (const e of d.ips ?? []) ips.add(e.ip)
  }

  console.log(`Checking ${ips.size} unique IPs over 91 days…\n`)

  const results: Array<{ ip: string; total: number; oldest: string | null; newest: string | null }> = []

  for (const ip of ips) {
    const res = await fetch(
      `${url}/api/queries?from=${from91}&until=${now}&length=1&start=0&client_ip=${encodeURIComponent(ip)}`,
      { headers: { sid } }
    )
    const data = (await res.json()) as {
      recordsFiltered: number
      queries: Array<{ time: number }>
    }
    const total = data.recordsFiltered ?? 0
    const newest = data.queries?.[0]?.time ? new Date(data.queries[0].time * 1000).toISOString() : null

    let oldest: string | null = null
    if (total > 0) {
      const lastRes = await fetch(
        `${url}/api/queries?from=${from91}&until=${now}&length=1&start=${total - 1}&client_ip=${encodeURIComponent(ip)}`,
        { headers: { sid } }
      )
      const lastData = (await lastRes.json()) as { queries: Array<{ time: number }> }
      oldest = lastData.queries?.[0]?.time
        ? new Date(lastData.queries[0].time * 1000).toISOString()
        : null
    }

    results.push({ ip, total, oldest, newest })
  }

  results.sort((a, b) => b.total - a.total)
  console.log('IP'.padEnd(18), 'Total'.padStart(10), 'Oldest'.padEnd(22), 'Newest')
  console.log('─'.repeat(80))
  for (const r of results) {
    console.log(
      r.ip.padEnd(18),
      r.total.toLocaleString().padStart(10),
      (r.oldest ?? '—').padEnd(22),
      r.newest ?? '—'
    )
  }
}

main().catch(console.error)
