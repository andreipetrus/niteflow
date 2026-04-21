import { z } from 'zod'
import { piholeGet } from './client'
import type { PiholeClientConfig } from './client'

const DeviceSchema = z.object({
  ip: z.string().optional(),
  name: z.string().optional(),
  hwaddr: z.string().optional(),
  lastQuery: z.number().optional(),
  interface: z.string().optional(),
})

const DevicesResponseSchema = z.object({
  devices: z.array(DeviceSchema),
})

export type PiholeDevice = {
  ip: string
  name: string
}

export async function fetchDevices(config: PiholeClientConfig): Promise<PiholeDevice[]> {
  const raw = await piholeGet<unknown>(config, '/api/network/devices')
  const parsed = DevicesResponseSchema.safeParse(raw)

  if (!parsed.success) {
    // Fallback: return empty list rather than crashing if API shape differs
    return []
  }

  return parsed.data.devices
    .filter((d): d is typeof d & { ip: string } => Boolean(d.ip))
    .map((d) => ({
      ip: d.ip,
      name: d.name ?? d.ip,
    }))
}
