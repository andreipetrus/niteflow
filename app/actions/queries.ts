'use server'

import { getTopDomainsByDevice } from '@/lib/db/queries/dns-queries'
import type { DomainCount } from '@/lib/db/queries/dns-queries'

export async function fetchTopDomains(
  deviceIps: string[],
  limit = 50,
  includeNoise = false
): Promise<DomainCount[]> {
  return getTopDomainsByDevice(deviceIps, limit, includeNoise)
}
