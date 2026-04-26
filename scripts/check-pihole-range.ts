/**
 * Inspects Pi-hole's available data range for the selected device IPs.
 * Helpful when diagnosing why local query DB has less data than expected.
 */
import Database from 'better-sqlite3'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'), { readonly: true })
const url = ((sqlite.prepare("SELECT value FROM settings WHERE key='pihole_url'").get() as { value: string } | undefined)?.value ?? '').replace(/\/$/, '')
const password = (sqlite.prepare("SELECT value FROM settings WHERE key='pihole_password'").get() as { value: string } | undefined)?.value
const deviceIps = JSON.parse(
  (sqlite.prepare("SELECT value FROM settings WHERE key='pihole_device_ips'").get() as { value: string } | undefined)?.value ?? '[]'
) as string[]

async function main() {
  if (!url || !password) {
    console.error('Missing Pi-hole creds.')
    process.exit(1)
  }

  const authRes = await fetch(`${url}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const auth = (await authRes.json()) as { session: { sid: string } }
  const sid = auth.session.sid

  const now = Math.floor(Date.now() / 1000)
  const full = now - 91 * 86400

  for (const ip of deviceIps) {
    console.log(`\n=== Client ${ip} ===`)

    // recordsTotal over 91 days
    const recentRes = await fetch(
      `${url}/api/queries?from=${full}&until=${now}&length=1&start=0&client_ip=${encodeURIComponent(ip)}`,
      { headers: { sid } }
    )
    const recent = (await recentRes.json()) as {
      recordsTotal: number
      recordsFiltered: number
      queries: Array<{ time: number; domain: string }>
      earliest_timestamp?: number
      earliest_timestamp_disk?: number
    }

    console.log(
      `  Pi-hole totals (91d window): total=${recent.recordsTotal?.toLocaleString() ?? '?'}, filtered=${recent.recordsFiltered?.toLocaleString() ?? '?'}`
    )
    if (recent.earliest_timestamp) {
      console.log(`  earliest_timestamp (memory): ${new Date(recent.earliest_timestamp * 1000).toISOString()}`)
    }
    if (recent.earliest_timestamp_disk) {
      console.log(`  earliest_timestamp_disk:    ${new Date(recent.earliest_timestamp_disk * 1000).toISOString()}`)
    }

    // Fetch the OLDEST record for this client (start from the end of filtered set)
    const oldest = recent.recordsFiltered && recent.recordsFiltered > 0 ? recent.recordsFiltered - 1 : 0
    const oldestRes = await fetch(
      `${url}/api/queries?from=${full}&until=${now}&length=1&start=${oldest}&client_ip=${encodeURIComponent(ip)}`,
      { headers: { sid } }
    )
    const oldestData = (await oldestRes.json()) as { queries: Array<{ time: number; domain: string }> }
    const first = oldestData.queries?.[0]
    if (first) {
      console.log(`  Oldest query for ${ip}: ${new Date(first.time * 1000).toISOString()} (${first.domain})`)
    }

    const newest = recent.queries?.[0]
    if (newest) {
      console.log(`  Newest query for ${ip}: ${new Date(newest.time * 1000).toISOString()} (${newest.domain})`)
    }
  }
}

main().catch(console.error)
