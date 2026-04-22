/**
 * Test Pi-hole v6 cursor pagination with client_ip filter
 */
import Database from 'better-sqlite3'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'), { readonly: true })
const getSetting = (key: string) => {
  const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

const url = (getSetting('pihole_url') ?? '').replace(/\/$/, '')
const password = getSetting('pihole_password')!

async function main() {
  const auth = await fetch(`${url}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then((r) => r.json())
  const sid = auth.session.sid

  const to = Math.floor(Date.now() / 1000)
  const from = to - 30 * 86400
  const clientIp = '192.168.4.36'

  // Test `start` offset pagination
  let start = 0
  let page = 0
  let totalReceived = 0

  while (page < 5) {
    page++
    const params = new URLSearchParams({
      from: String(from),
      until: String(to),
      length: '1000',
      start: String(start),
      client_ip: clientIp,
    })

    const res = await fetch(`${url}/api/queries?${params}`, { headers: { sid } })
    const json = await res.json()
    const count = json.queries?.length ?? 0
    totalReceived += count
    const firstId = json.queries?.[0]?.id
    const lastId = json.queries?.[count - 1]?.id

    console.log(
      `page ${page}: start=${start} count=${count} total=${totalReceived} firstId=${firstId} lastId=${lastId}`
    )

    if (count === 0 || count < 1000) break
    start += 1000
  }
}

main().catch(console.error)
