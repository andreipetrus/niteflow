import { z } from 'zod'
import { piholeGet } from './client'
import type { PiholeClientConfig } from './client'

const IpEntrySchema = z.object({
  ip: z.string(),
  ptr: z.string().optional(),
})

const DeviceSchema = z.object({
  id: z.number().optional(),
  hwaddr: z.string().optional(),
  name: z.string().optional(),
  interface: z.string().optional(),
  macVendor: z.string().optional(),
  lastQuery: z.number().optional(),
  numQueries: z.number().optional(),
  // Pi-hole v6 nests IPs as an array of objects
  ips: z.array(IpEntrySchema).optional(),
})

const DevicesResponseSchema = z.object({
  devices: z.array(DeviceSchema),
  recordsTotal: z.number().optional(),
})

export type PiholeDevice = {
  ip: string
  name: string
}

export async function fetchDevices(config: PiholeClientConfig): Promise<PiholeDevice[]> {
  const raw = await piholeGet<unknown>(config, '/api/network/devices')
  const parsed = DevicesResponseSchema.safeParse(raw)

  if (!parsed.success) {
    console.error('[pihole] fetchDevices: unexpected response shape', parsed.error.issues)
    throw new Error('Unexpected Pi-hole response — check the server logs for details')
  }

  const result: PiholeDevice[] = []

  for (const device of parsed.data.devices) {
    const ips = device.ips ?? []
    // Each device can have multiple IPs (IPv4 + IPv6) — include one entry per IP
    for (const entry of ips) {
      result.push({
        ip: entry.ip,
        name: device.name ?? entry.ptr ?? entry.ip,
      })
    }
  }

  return result
}
